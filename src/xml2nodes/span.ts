import { Span, compoundSpan } from 'booka-common';
import {
    reject, yieldLast, SuccessLast,
    ResultLast, compoundResult, compoundDiagnostic,
} from '../combinators';
import { Xml, xml2string } from '../xml';
import { Xml2NodesEnv, unexpectedNode, expectEmptyContent, buildRefId } from './common';

export function expectSpanContent(nodes: Xml[], env: Xml2NodesEnv): SuccessLast<Span[]> {
    const results = nodes.map(n => {
        const s = singleSpan(n, env);
        return !s.success
            ? yieldLast('', unexpectedNode(n, 'span'))
            : s;
    });
    return compoundResult(results);
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
                compoundDiagnostic([expectEmptyContent(node.children), insideDiag]),
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
                    compoundDiagnostic([expectEmptyContent(node.children), insideDiag]),
                );
            } else {
                return yieldLast('', compoundDiagnostic([{
                    diag: 'img: src not set',
                    xml: xml2string(node),
                }, insideDiag]));
            }
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
