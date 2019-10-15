import { Span, compoundSpan, FlagSemanticKey, flagSemantic, semanticSpan } from 'booka-common';
import {
    failure, success, Success,
    Result, compoundResult, compoundDiagnostic, Diagnostic,
} from '../combinators';
import { Xml, xml2string } from '../xml';
import { Xml2NodesEnv, unexpectedNode, expectEmptyContent, buildRefId } from './common';
import { XmlElement } from '../xml/xmlTree';

export function expectSpanContent(nodes: Xml[], env: Xml2NodesEnv): Success<Span[]> {
    const results = nodes.map(n => {
        const s = singleSpan(n, env);
        return !s.success
            ? success('', unexpectedNode(n, 'span'))
            : s;
    });
    return success(
        results.map(r => r.value),
        compoundDiagnostic(results.map(r => r.diagnostic)),
    );
}

export function spanContent(nodes: Xml[], env: Xml2NodesEnv): Result<Span[]> {
    const spans = expectSpanContent(nodes, env);
    return spans.diagnostic === undefined
        ? spans
        : failure();
}

export function singleSpan(node: Xml, env: Xml2NodesEnv): Result<Span> {
    const result = singleSpanImpl(node, env);
    if (!result.success) {
        return result;
    }
    let span = result.value;
    if (node.type === 'element' && node.attributes.id !== undefined) {
        const refId = buildRefId(env.filePath, node.attributes.id);
        span = { a: span, refId };
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
            if (node.attributes.href !== undefined) {
                return success({
                    ref: insideSpan,
                    refToId: node.attributes.href,
                }, insideDiag);
            } else {
                return insideDiag === undefined
                    ? success(insideSpan)
                    : failure();
            }
        default:
            return failure();
    }
}

function flagSpan(inside: Span, flag: FlagSemanticKey): Span {
    return {
        span: inside,
        semantics: [flagSemantic(flag)],
    };
}

function imgSpan(node: XmlElement, env: Xml2NodesEnv): Success<Span> {
    if (node.attributes.src !== undefined) {
        return success(
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
        return success('', compoundDiagnostic([
            {
                diag: 'img: src not set',
                severity: 'info',
                xml: xml2string(node),
            },
            expectEmptyContent(node.children),
        ]));
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

    const resultSpan = semanticSpan(compoundSpan(spans), [{
        semantic: 'ruby',
        ruby: explanation,
    }]);
    return success(resultSpan, compoundDiagnostic(diags));
}
