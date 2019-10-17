import {
    Span, compoundSpan,
    failure, success, Success,
    Result, compoundDiagnostic, Diagnostic, NodeFlag, AttributeName, attrSpan, flagSpan, nodeSpans, flatten, extractSpanText,
} from 'booka-common';
import { Xml, xml2string } from '../xml';
import { Xml2NodesEnv, unexpectedNode, expectEmptyContent, buildRefId, imgData } from './common';
import { XmlElement } from '../xml/xmlTree';
import { tableNode } from './table';

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

function singleSpanImpl(node: Xml, env: Xml2NodesEnv): Result<Span> {
    if (node.type === 'text') {
        return success(node.text);
    } else if (node.type !== 'element') {
        return failure();
    }

    switch (node.name) {
        case 'span':
            {
                const inside = spanContent(node.children, env);
                return inside.success
                    ? success(compoundSpan(inside.value), inside.diagnostic)
                    : inside;
            }
        case 'i': case 'em':
            return parseAttributeSpan(node, 'italic', env);
        case 'b': case 'strong':
            return parseAttributeSpan(node, 'bold', env);
        case 'small':
            return parseAttributeSpan(node, 'small', env);
        case 'big':
            return parseAttributeSpan(node, 'big', env);
        case 'sup':
            return parseAttributeSpan(node, 'sup', env);
        case 'sub':
            return parseAttributeSpan(node, 'sub', env);
        case 'q': case 'quote':
            return parseAttributeSpan(node, 'quote', env);
        case 'blockquote': case 'cite':
            {
                const inside = spanContent(node.children, env);
                return inside.success
                    ? success(attrSpan(compoundSpan(inside.value), 'quote'), inside.diagnostic)
                    : inside;
            }
        case 'code': case 'samp': case 'var':
            return parseFlagSpan(node, 'code', env);
        case 'dfn':
            return parseFlagSpan(node, 'definition', env);
        case 'address':
            return parseFlagSpan(node, 'address', env);
        case 'bdo':
            return parseFlagSpan(node, 'right-to-left', env);
        case 'ins': case 'del':
            return parseFlagSpan(node, 'correction', env);
        case 'ruby':
            return parseRubySpan(node, env);
        case 'br':
            return success(
                '\n',
                compoundDiagnostic([expectEmptyContent(node.children)]),
            );
        case 'img':
            return imgSpan(node, env);
        case 'font':
        case 'tt':
        case 'abbr':
            return parseFlagSpan(node, 'abbreviation', env);
        case 'a':
            return aSpan(node, env);
        default:
            return failure();
    }
}

function parseAttributeSpan(node: XmlElement, attr: AttributeName, env: Xml2NodesEnv): Success<Span> {
    const inside = expectSpanContent(node.children, env);

    return success(
        attrSpan(compoundSpan(inside.value), attr),
        inside.diagnostic,
    );
}

function parseFlagSpan(node: XmlElement, flag: NodeFlag, env: Xml2NodesEnv): Success<Span> {
    const inside = expectSpanContent(node.children, env);
    return success(
        flagSpan(compoundSpan(inside.value), flag),
        inside.diagnostic,
    );
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

function parseRubySpan(node: XmlElement, env: Xml2NodesEnv): Success<Span> {
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
                    const inside = expectSpanContent(sub.children, env);
                    diags.push(inside.diagnostic);
                    explanation += extractSpanText(inside.value);
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
