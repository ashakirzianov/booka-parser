import {
    Span, compoundSpan,
    failure, success, Success,
    Result, compoundDiagnostic, Diagnostic, Semantic, projectResult,
} from 'booka-common';
import { Xml, xml2string } from '../xml';
import { Xml2NodesEnv, unexpectedNode, expectEmptyContent, buildRefId, imgData } from './common';
import { XmlElement } from '../xml/xmlTree';

export function expectSpanContent(nodes: Xml[], env: Xml2NodesEnv): Success<Span[]> {
    const results = nodes.map(n => {
        const s = singleSpan(n, env);
        return !s.success
            ? success([], unexpectedNode(n, 'span'))
            : s;
    });
    return success(
        results.map(r => r.value),
        compoundDiagnostic(results.map(r => r.diagnostic)),
    );
}

export function spanContent(nodes: Xml[], env: Xml2NodesEnv): Result<Span[]> {
    const diags: Diagnostic[] = [];
    const spans: Span[] = [];
    for (const node of nodes) {
        const result = singleSpan(node, env);
        if (!result.success) {
            return result;
        }
        spans.push(result.value);
        diags.push(result.diagnostic);
    }

    return success(spans, compoundDiagnostic(diags));
}

export function singleSpan(node: Xml, env: Xml2NodesEnv): Result<Span> {
    const result = singleSpanImpl(node, env);
    if (!result.success) {
        return result;
    }
    let span = result.value;
    if (node.type === 'element' && node.attributes.id !== undefined) {
        const refId = buildRefId(env.filePath, node.attributes.id);
        span = { span, refId };
    }

    return success(span, result.diagnostic);
}

// TODO: refactor (use attrSpan etc.)
function singleSpanImpl(node: Xml, env: Xml2NodesEnv): Result<Span> {
    if (node.type === 'text') {
        return success(node.text);
    } else if (node.type !== 'element') {
        return failure();
    }

    const inside = expectSpanContent(node.children, env);
    const insideSpan = compoundSpan(inside.value);
    const insideDiag = inside.diagnostic;

    switch (node.name) {
        case 'span':
            return insideDiag === undefined
                ? success(inside.value)
                : failure();
        case 'i': case 'em':
            return success({ italic: insideSpan }, insideDiag);
        case 'b': case 'strong':
            return success({ bold: insideSpan }, insideDiag);
        case 'small':
            return success({ small: insideSpan }, insideDiag);
        case 'big':
            return success({ big: insideSpan }, insideDiag);
        case 'sup':
            return success({ sup: insideSpan }, insideDiag);
        case 'sub':
            return success({ sub: insideSpan }, insideDiag);
        case 'q': case 'quote': case 'blockquote': case 'cite':
            return insideDiag === undefined
                ? success({
                    span: insideSpan,
                    semantics: [{
                        semantic: 'quote',
                    }],
                }, insideDiag)
                : failure();
        case 'code': case 'samp': case 'var':
            return success(flagSpan(insideSpan, 'code'), insideDiag);
        case 'dfn':
            return success(flagSpan(insideSpan, 'definition'), insideDiag);
        case 'address':
            return success(flagSpan(insideSpan, 'address'), insideDiag);
        case 'bdo':
            return success(flagSpan(insideSpan, 'right-to-left'), insideDiag);
        case 'ins': case 'del':
            return success({
                span: insideSpan,
                semantics: [{
                    semantic: 'correction',
                    note: node.attributes.title,
                }],
            }, insideDiag);
        case 'ruby':
            return rubySpan(node, env);
        case 'br':
            return success(
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
            return aSpan(node, env);
        default:
            return failure();
    }
}

function flagSpan(inside: Span, flag: Semantic): Span {
    return {
        span: inside,
        flags: [flag],
    };
}

function aSpan(node: XmlElement, env: Xml2NodesEnv): Result<Span> {
    if (node.attributes.href !== undefined) {
        const inside = expectSpanContent(node.children, env);
        return success({
            span: inside.value,
            refToId: node.attributes.href,
        }, inside.diagnostic);
    } else {
        const inside = spanContent(node.children, env);
        return inside;
    }
}

function imgSpan(node: XmlElement, env: Xml2NodesEnv): Success<Span> {
    const image = imgData(node, env);
    if (image.value !== undefined) {
        return success(
            { image: image.value },
            image.diagnostic,
        );
    } else {
        return success([], image.diagnostic);
    }
}

function rubySpan(node: XmlElement, env: Xml2NodesEnv): Success<Span> {
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

    const resultSpan: Span = {
        span: compoundSpan(spans),
        ruby: explanation,
    };
    return success(resultSpan, compoundDiagnostic(diags));
}
