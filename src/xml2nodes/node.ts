import {
    Span, BookNode, appendSemantics,
    makePph, compoundSpan,
    Diagnostic, Result, Success,
    failure, success, compoundDiagnostic, Semantic,
} from 'booka-common';
import {
    Xml, XmlElement,
} from '../xml';
import {
    Xml2NodesEnv, unexpectedNode, expectEmptyContent, shouldIgnore, buildRefId, imgData,
} from './common';
import { expectSpanContent, singleSpan, spanContent } from './span';
import { tableNode } from './table';
import { listNode } from './list';
import { processNodeAttributes } from './attributes';

export function topLevelNodes(nodes: Xml[], env: Xml2NodesEnv): Success<BookNode[]> {
    const results: BookNode[] = [];
    const diags: Diagnostic[] = [];
    for (let idx = 0; idx < nodes.length; idx++) {
        let node = nodes[idx];
        // Ignore some nodes
        if (shouldIgnore(node)) {
            continue;
        }
        // Try parse top-level node
        const nodeResult = singleNode(node, env);
        if (nodeResult.success) {
            results.push(...nodeResult.value);
            diags.push(nodeResult.diagnostic);
            continue;
        }

        // Try parse span
        const spans: Span[] = [];
        let span = singleSpan(node, env);
        while (span.success) {
            spans.push(span.value);
            diags.push(span.diagnostic);
            idx++;
            if (idx >= nodes.length) {
                break;
            }
            node = nodes[idx];
            span = singleSpan(node, env);
        }

        if (spans.length > 0) {
            const pph: BookNode = makePph(compoundSpan(spans));
            results.push(pph);
            idx--;
        } else {
            // Report unexpected
            diags.push(unexpectedNode(node));
        }
    }

    return success(results, compoundDiagnostic(diags));
}

function singleNode(node: Xml, env: Xml2NodesEnv): Result<BookNode[]> {
    const result = singleNodeImpl(node, env);
    if (result.success) {
        const attrs = processNodeAttributes(node, env);
        const diag = compoundDiagnostic([result.diagnostic, attrs.diag]);

        let bookNodes = result.value;
        if (node.type === 'element' && node.attributes.id !== undefined) {
            const refId = buildRefId(env.filePath, node.attributes.id);
            bookNodes = assignRefIdToNodes(bookNodes, refId);
        }
        if (attrs.semantics && attrs.semantics.length > 0) {
            bookNodes = assignSemanticsToNodes(bookNodes, attrs.semantics);
        }
        return success(bookNodes, diag);
    } else {
        return result;
    }
}

function singleNodeImpl(node: Xml, env: Xml2NodesEnv): Result<BookNode[]> {
    switch (node.name) {
        case 'blockquote':
            {
                const pph = paragraphNode(node, env);
                const result = assignSemanticsToNodes(pph.value, ['quote']);
                return success(result, pph.diagnostic);
            }
        case 'pre':
            {
                const result = paragraphNode(node, env);
                return success(
                    assignSemanticsToNodes(result.value, ['preserve']),
                    result.diagnostic
                );
            }
        case 'p':
        case 'div':
        case 'span':
            return paragraphNode(node, env);
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            return titleNode(node, env);
        case 'hr':
            return separatorNode(node, env);
        case 'table':
            return tableNode(node, env);
        case 'ul':
        case 'ol':
        case 'dl': // TODO: handle separately ?
            return listNode(node, env);
        case 'img':
            return imageNode(node, env);
        default:
            return failure();
    }
}

function imageNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    const image = imgData(node, env);
    if (image.value !== undefined) {
        return success([{
            node: 'image',
            image: image.value,
        }], image.diagnostic);
    } else {
        return success([], image.diagnostic);
    }
}

function separatorNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    const separator: BookNode = {
        node: 'separator',
    };
    return success([separator], expectEmptyContent(node.children));
}

function titleNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    const level = 4 - parseInt(node.name[1], 10);
    const spans = expectSpanContent(node.children, env);
    const title: BookNode = {
        node: 'title',
        span: compoundSpan(spans.value),
        level,
    };
    return success([title], spans.diagnostic);
}

function paragraphNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    const span = spanContent(node.children, env);
    if (span.success) {
        const pph: BookNode = makePph(span.value);
        return success([pph], span.diagnostic);
    } else {
        return containerNode(node, env);
    }
}

function containerNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    return topLevelNodes(node.children, env);
}

function assignRefIdToNodes([head, ...rest]: BookNode[], refId: string): BookNode[] {
    if (head !== undefined) {
        if (head.refId === undefined) {
            const withId = {
                ...head,
                refId,
            };
            return [withId, ...rest];
        } else {
            return [anchorNode(refId), head, ...rest];
        }
    } else {
        return [anchorNode(refId)];
    }
}

function anchorNode(refId: string): BookNode {
    return {
        node: 'pph',
        span: [],
        refId,
    };
}

function assignSemanticsToNodes(nodes: BookNode[], semantics: Semantic[]): BookNode[] {
    return nodes.map(n => appendSemantics(n, semantics));
}
