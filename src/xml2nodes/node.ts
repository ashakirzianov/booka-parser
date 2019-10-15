import {
    Span, GroupNode, BookNode, appendSemantics,
    makePph, compoundSpan,
} from 'booka-common';
import {
    Xml, XmlElement, xml2string,
} from '../xml';
import {
    Diagnostic, Result, Success,
    failure, success, compoundDiagnostic,
} from '../combinators';
import {
    Xml2NodesEnv, unexpectedNode, expectEmptyContent, shouldIgnore, buildRefId,
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
            results.push(nodeResult.value);
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

function singleNode(node: Xml, env: Xml2NodesEnv): Result<BookNode> {
    const result = singleNodeImpl(node, env);
    if (result.success) {
        const attrs = processNodeAttributes(node, env);
        const diag = compoundDiagnostic([result.diagnostic, attrs.diag]);

        let bookNode = result.value;
        if (node.type === 'element' && node.attributes.id !== undefined) {
            const refId = buildRefId(env.filePath, node.attributes.id);
            bookNode = { ...bookNode, refId };
        }
        if (attrs.semantics && attrs.semantics.length > 0) {
            bookNode = appendSemantics(bookNode, attrs.semantics);
        }
        return success(bookNode, diag);
    } else {
        return result;
    }
}

function singleNodeImpl(node: Xml, env: Xml2NodesEnv): Result<BookNode> {
    switch (node.name) {
        case 'blockquote':
            {
                const pph = paragraphNode(node, env);
                const result = appendSemantics(pph.value, [{ semantic: 'quote' }]);
                return success(result, pph.diagnostic);
            }
        case 'p':
        case 'div':
        case 'span':
        case 'pre': // TODO: assign some semantics ?
            return paragraphNode(node, env);
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            {
                const level = 4 - parseInt(node.name[1], 10);
                const spans = expectSpanContent(node.children, env);
                const title: BookNode = {
                    node: 'title',
                    span: compoundSpan(spans.value),
                    level,
                };
                return success(title, spans.diagnostic);
            }
        case 'hr':
            {
                const separator: BookNode = {
                    node: 'separator',
                };
                return success(separator, expectEmptyContent(node.children));
            }
        case 'table':
            return tableNode(node, env);
        case 'ul':
        case 'ol':
        case 'dl': // TODO: handle separately ?
            return listNode(node, env);
        default:
            return failure();
    }
}

function paragraphNode(node: XmlElement, env: Xml2NodesEnv) {
    const span = spanContent(node.children, env);
    if (span.success) {
        const pph: BookNode = makePph(span.value);
        return success(pph, span.diagnostic);
    } else {
        return groupNode(node, env);
    }
}

function groupNode(node: XmlElement, env: Xml2NodesEnv): Success<GroupNode> {
    const content = topLevelNodes(node.children, env);
    const group: BookNode = {
        node: 'group',
        nodes: content.value,
    };
    return success(group, content.diagnostic);
}
