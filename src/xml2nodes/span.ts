import { Span, compoundSpan, FlagSemanticKey, flagSemantic, semanticSpan } from 'booka-common';
import {
    reject, yieldLast, SuccessLast,
    ResultLast, compoundResult, compoundDiagnostic, Diagnostic,
} from '../combinators';
import { Xml, xml2string } from '../xml';
import { Xml2NodesEnv, unexpectedNode, expectEmptyContent, buildRefId } from './common';
import { XmlElement } from '../xml/xmlTree';

export function expectSpanContent(nodes: Xml[], env: Xml2NodesEnv): SuccessLast<Span[]> {
    const results = nodes.map(n => {
        const s = singleSpan(n, env);
        return !s.success
            ? yieldLast('', unexpectedNode(n, 'span'))
            : s;
    });
    return yieldLast(
        results.map(r => r.value),
        compoundDiagnostic(results.map(r => r.diagnostic)),
    );
}

export function spanContent(nodes: Xml[], env: Xml2NodesEnv): ResultLast<Span[]> {
    const spans = expectSpanContent(nodes, env);
    return spans.diagnostic === undefined
        ? spans
        : reject();
}

export function singleSpan(node: Xml, env: Xml2NodesEnv): ResultLast<Span> {
    const result = singleSpanImpl(node, env);
    if (!result.success) {
        return result;
    }
    let span = result.value;
    if (node.type === 'element' && node.attributes.id !== undefined) {
        const refId = buildRefId(env.filePath, node.attributes.id);
        span = { a: span, refId };
    }

    return yieldLast(span, result.diagnostic);
}

// TODO: refactor (use attrSpan etc.)
function singleSpanImpl(node: Xml, env: Xml2NodesEnv): ResultLast<Span> {
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
        case 'q': case 'quote': case 'blockquote': case 'cite':
            return insideDiag === undefined
                ? yieldLast({
                    span: insideSpan,
                    semantics: [{
                        semantic: 'quote',
                    }],
                }, insideDiag)
                : reject();
        case 'code': case 'samp': case 'var':
            return yieldLast(flagSpan(insideSpan, 'code'), insideDiag);
        case 'dfn':
            return yieldLast(flagSpan(insideSpan, 'definition'), insideDiag);
        case 'address':
            return yieldLast(flagSpan(insideSpan, 'address'), insideDiag);
        case 'bdo':
            return yieldLast(flagSpan(insideSpan, 'right-to-left'), insideDiag);
        case 'ins': case 'del':
            return yieldLast({
                span: insideSpan,
                semantics: [{
                    semantic: 'correction',
                    note: node.attributes.title,
                }],
            }, insideDiag);
        case 'ruby':
            return rubySpan(node, env);
        case 'br':
            return yieldLast(
                '\n',
                compoundDiagnostic([expectEmptyContent(node.children), insideDiag]),
            );
        case 'img':
            return imgSpan(node, env);
        case 'font':
        case 'tt':
        case 'abbr': // TODO: handle
            return inside;
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

function flagSpan(inside: Span, flag: FlagSemanticKey): Span {
    return {
        span: inside,
        semantics: [flagSemantic(flag)],
    };
}

function imgSpan(node: XmlElement, env: Xml2NodesEnv): SuccessLast<Span> {
    if (node.attributes.src !== undefined) {
        return yieldLast(
            {
                image: {
                    image: 'ref',
                    imageId: node.attributes.src,
                    title: node.attributes.title || node.attributes.alt,
                },
            },
            expectEmptyContent(node.children),
        );
    } else {
        return yieldLast('', compoundDiagnostic([
            {
                diag: 'img: src not set',
                severity: 'info',
                xml: xml2string(node),
            },
            expectEmptyContent(node.children),
        ]));
    }
}

function rubySpan(node: XmlElement, env: Xml2NodesEnv): SuccessLast<Span> {
    const spans: Span[] = [];
    const diags: Diagnostic[] = [];
    let explanation: string = '';
    for (const sub of node.children) {
        switch (sub.name) {
            case 'rb':
                {
                    const inside = expectSpanContent(sub.children, env);
                    diags.push(inside.diagnostic);
                    spans.push(...inside.value);
                }
                break;
            case 'rt':
                {
                    const [head, ...rest] = sub.children;
                    if (head !== undefined && head.type === 'text' && rest.length === 0) {
                        explanation += head.text;
                    } else {
                        diags.push({
                            diag: 'unexpected rt content',
                            xml: sub.children.map(xml2string),
                        });
                    }
                }
                break;
            case 'rp':
                break;
            default:
                {
                    const span = singleSpan(sub, env);
                    diags.push(span.diagnostic);
                    if (span.success) {
                        spans.push(span.value);
                    } else {
                        diags.push({
                            diag: 'unexpected ruby content',
                            xml: xml2string(sub),
                        });
                    }
                }
                break;
        }
    }

    const resultSpan = semanticSpan(compoundSpan(spans), [{
        semantic: 'ruby',
        ruby: explanation,
    }]);
    return yieldLast(resultSpan, compoundDiagnostic(diags));
}
