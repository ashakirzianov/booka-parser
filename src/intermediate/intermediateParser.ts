import {
    BookContentNode, ParagraphNode, Span, TitleNode, GroupNode,
    makePph, compoundSpan, extractSpanText, assertNever,
} from 'booka-common';
import { SuccessLast, yieldLast } from '../combinators';
import {
    IntermTop, IntermSpan, IntermPph, IntermHeader, IntermContainer,
} from './intermediateNode';

export function parseIntermediateNodes(inters: IntermTop[], filePath: string): SuccessLast<BookContentNode[]> {
    const nodes = fromInters(inters, {
        filePath,
    });
    return yieldLast(nodes);
}

type Env = {
    filePath: string,
};
function fromInter(inter: IntermTop, env: Env): BookContentNode {
    switch (inter.interm) {
        case 'pph':
            return fromPph(inter, env);
        case 'header':
            return fromHeader(inter, env);
        case 'container':
            return fromContainer(inter, env);
        case 'table':
        case 'list':
            // TODO: implement
            return '';
        default:
            assertNever(inter);
            return '';
    }
}

function fromInters(inters: IntermTop[], env: Env): BookContentNode[] {
    return inters.map(i => {
        let result = fromInter(i, env);
        if (i.attrs.id !== undefined) {
            if (result.node === undefined) {
                result = {
                    node: 'pph',
                    span: result,
                    refId: i.attrs.id,
                };
            } else {
                result.refId = i.attrs.id;
            }
        }
        return result;
    });
}

function fromSpan(s: IntermSpan, env: Env): Span {
    switch (s.interm) {
        case 'text':
            return s.content;
        case 'italic': case 'bold':
        case 'big': case 'small':
        case 'sub': case 'sup':
            return { [s.interm]: fromSpans(s.content, env) };
        case 'span':
            return fromSpans(s.content, env);
        case 'img':
            return s.attrs.src
                ? {
                    image: {
                        kind: 'ref',
                        imageId: s.attrs.src,
                        ref: s.attrs.src,
                        title: s.attrs.title || s.attrs.alt,
                    },
                }
                : '';
        case 'quote':
            return {
                span: fromSpans(s.content, env),
                semantic: { quote: {} },
            };
        case 'ins':
            return {
                span: fromSpans(s.content, env),
                semantic: {
                    correction: {
                        note: s.attrs.title,
                    },
                },
            };
        case 'a':
            return s.attrs.href
                ? { ref: fromSpans(s.content, env), refToId: s.attrs.ref }
                : fromSpans(s.content, env);
        default:
            assertNever(s);
            return '';
    }
}

function fromSpans(ss: IntermSpan[], env: Env): Span {
    return compoundSpan(ss.map(s => fromSpan(s, env)));
}

function fromPph(p: IntermPph, env: Env): ParagraphNode {
    return makePph(fromSpans(p.content, env));
}

function fromHeader(h: IntermHeader, env: Env): TitleNode {
    const s = fromSpans(h.content, env);
    const text = extractSpanText(s);
    return {
        node: 'title',
        lines: [text],
        level: h.level,
    };
}

function fromContainer(c: IntermContainer, env: Env): GroupNode {
    const nodes = fromInters(c.content, env);
    return {
        node: 'group',
        nodes,
    };
}
