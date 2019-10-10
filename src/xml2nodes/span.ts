import {
    ParserDiagnostic, reject, yieldLast, SuccessLast,
    ResultLast, compoundResult, projectResult, compoundDiagnostic,
} from '../combinators';
import { XmlTree, tree2String } from '../xmlStringParser';
import { Span, compoundSpan } from 'booka-common';
import { Env } from './base';

export function expectSpanContent(nodes: XmlTree[], env: Env): SuccessLast<Span[]> {
    const results = nodes.map(n => {
        const s = singleSpan(n, env);
        return !s.success
            ? yieldLast('', {
                diag: 'unexpected node in span',
                xml: tree2String(n),
            })
            : s;
    });
    return compoundResult(results);
}

export function spanContent(nodes: XmlTree[], env: Env): ResultLast<Span[]> {
    const spans = expectSpanContent(nodes, env);
    return spans.diagnostic === undefined
        ? spans
        : reject();
}

export function singleSpan(node: XmlTree, env: Env): ResultLast<Span> {
    if (node.type === 'text') {
        return yieldLast(node.text);
    } else if (node.type !== 'element') {
        return reject();
    }

    const inside = expectSpanContent(node.children, env);
    const insideSpan = compoundSpan(inside.value);
    const insideDiag = inside.diagnostic;

    switch (node.name) {
        case 'span':
            return insideDiag === undefined
                ? yieldLast(inside.value)
                : reject();
        case 'i': case 'em':
            return yieldLast({ italic: insideSpan }, insideDiag);
        case 'b': case 'strong':
            return yieldLast({ bold: insideSpan }, insideDiag);
        case 'small':
            return yieldLast({ small: insideSpan }, insideDiag);
        case 'big':
            return yieldLast({ big: insideSpan }, insideDiag);
        case 'sup':
            return yieldLast({ sup: insideSpan }, insideDiag);
        case 'sub':
            return yieldLast({ sub: insideSpan }, insideDiag);
        case 'q': case 'quote': case 'blockquote':
            return insideDiag === undefined
                ? yieldLast({
                    span: insideSpan,
                    semantics: [{
                        semantic: 'quote',
                    }],
                }, insideDiag)
                : reject();
        case 'ins':
            return yieldLast({
                span: insideSpan,
                semantics: [{
                    semantic: 'correction',
                    note: node.attributes.title,
                }],
            }, insideDiag);
        case 'br':
            return yieldLast(
                '\n',
                compoundDiagnostic([shouldBeEmpty(node.children), insideDiag]),
            );
        case 'img':
            if (node.attributes.src !== undefined) {
                return yieldLast(
                    {
                        image: {
                            kind: 'ref',
                            ref: node.attributes.src,
                            imageId: node.attributes.src,
                            title: node.attributes.title || node.attributes.alt,
                        },
                    },
                    compoundDiagnostic([shouldBeEmpty(node.children), insideDiag]),
                );
            } else {
                return yieldLast('', compoundDiagnostic([{
                    diag: 'img: src not set',
                    xml: tree2String(node),
                }, insideDiag]));
            }
            break;
        case 'a':
            if (node.attributes.href !== undefined) {
                return yieldLast({
                    ref: insideSpan,
                    refToId: node.attributes.href,
                }, insideDiag);
            } else {
                return insideDiag === undefined
                    ? yieldLast(insideSpan)
                    : reject();
            }
        default:
            return reject();
    }
}

function shouldBeEmpty(children: XmlTree[]): ParserDiagnostic {
    return children.length !== 0
        ? {
            diag: 'unexpected span content',
            inside: children.map(tree2String),
        }
        : undefined;
}
