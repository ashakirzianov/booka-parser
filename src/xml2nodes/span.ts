import {
    Span, failure, success, Success,
    Result, compoundDiagnostic, Diagnostic, NodeFlag, AttributeName, extractSpanText,
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
    let content = result.value;
    if (node.type === 'element' && node.attributes.id !== undefined) {
        const refId = buildRefId(env.filePath, node.attributes.id);
        content = content.span === undefined
            ? { span: 'plain', content, refId }
            : { ...content, refId };
    }

    return success(content, result.diagnostic);
}

function singleSpanImpl(node: Xml, env: Xml2NodesEnv): Result<Span> {
    if (node.type === 'text') {
        return success(node.text);
    } else if (node.type !== 'element') {
        return failure();
    }

    switch (node.name) {
        case 'span': case 'tt': case 'font':
            {
                const inside = spanContent(node.children, env);
                return inside.success
                    ? success(inside.value, inside.diagnostic)
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
        case 'blockquote': case 'cite': // Note: for some reason pg use it as a container sometimes
            {
                const content = spanContent(node.children, env);
                if (content.success) {
                    const span: Span = {
                        span: 'plain',
                        flags: ['quote'],
                        content: content.value,
                    };
                    return success(span, content.diagnostic);
                } else {
                    return content;
                }
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
        case 'abbr':
            return parseFlagSpan(node, 'abbreviation', env);
        case 'a':
            return aSpan(node, env);
        case 'hr': // Ignore separators within the span
            return success([]);
        default:
            return failure();
    }
}

function parseAttributeSpan(node: XmlElement, attr: AttributeName, env: Xml2NodesEnv): Success<Span> {
    const content = expectSpanContent(node.children, env);
    const span: Span = {
        span: attr,
        content: content.value,
    };

    return success(
        span,
        content.diagnostic,
    );
}

function parseFlagSpan(node: XmlElement, flag: NodeFlag, env: Xml2NodesEnv): Success<Span> {
    const content = expectSpanContent(node.children, env);
    const span: Span = {
        span: 'plain',
        content: content.value,
        flags: [flag],
    };
    return success(
        span,
        content.diagnostic,
    );
}

function aSpan(node: XmlElement, env: Xml2NodesEnv): Result<Span> {
    if (node.attributes.href !== undefined) {
        const content = expectSpanContent(node.children, env);
        const span: Span = {
            span: 'ref',
            refToId: node.attributes.href,
            content: content.value,
        };
        return success(span, content.diagnostic);
    } else {
        const inside = spanContent(node.children, env);
        return inside;
    }
}

function imgSpan(node: XmlElement, env: Xml2NodesEnv): Success<Span> {
    const image = imgData(node, env);
    if (image.value !== undefined) {
        return success(
            { span: 'image', image: image.value },
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
        span: 'ruby',
        explanation,
        content: spans,
    };
    return success(resultSpan, compoundDiagnostic(diags));
}
