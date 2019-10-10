import {
    Span, GroupNode, BookContentNode, appendSemantics,
    makePph, extractSpanText, compoundSpan,
} from 'booka-common';
import {
    Xml, XmlElement,
} from '../xml';
import {
    ParserDiagnostic, ResultLast, SuccessLast,
    reject, yieldLast, compoundDiagnostic,
} from '../combinators';
import {
    Xml2NodesEnv, unexpectedNode, expectEmptyContent, shouldIgnore,
} from './common';
import { expectSpanContent, singleSpan, spanContent } from './span';
import { tableNode } from './table';
import { listNode } from './list';
import { processNodeAttributes } from './attributes';

export function topLevelNodes(nodes: Xml[], env: Xml2NodesEnv): SuccessLast<BookContentNode[]> {
    const results: BookContentNode[] = [];
    const diags: ParserDiagnostic[] = [];
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
            const pph: BookContentNode = makePph(compoundSpan(spans));
            results.push(pph);
        } else {
            // Report unexpected
            diags.push(unexpectedNode(node));
        }
    }

    return yieldLast(results, compoundDiagnostic(diags));
}

function singleNode(node: Xml, env: Xml2NodesEnv): ResultLast<BookContentNode> {
    const result = singleNodeImpl(node, env);
    if (result.success) {
        // const attrs = { diag: undefined };
        const attrs = processNodeAttributes(node, env);
        const diag = compoundDiagnostic([result.diagnostic, attrs.diag]);

        let bookNode = result.value;
        if (node.type === 'element' && node.attributes.id !== undefined) {
            const refId = buildRefId(env.filePath, node.attributes.id);
            bookNode = bookNode.node === undefined
                ? {
                    node: 'pph',
                    span: bookNode,
                    refId,
                }
                : { ...bookNode, refId };
        }
        if (attrs.semantics && attrs.semantics.length > 0) {
            bookNode = appendSemantics(bookNode, attrs.semantics);
        }
        return yieldLast(bookNode, diag);
    } else {
        return result;
    }
}

function singleNodeImpl(node: Xml, env: Xml2NodesEnv): ResultLast<BookContentNode> {
    switch (node.name) {
        case 'blockquote':
            {
                const pph = paragraphNode(node, env);
                const result = appendSemantics(pph.value, [{ semantic: 'quote' }]);
                return yieldLast(result, pph.diagnostic);
            }
        case 'p':
        case 'div':
        case 'span':
            return paragraphNode(node, env);
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            {
                const level = 4 - parseInt(node.name[1], 10);
                const spans = expectSpanContent(node.children, env);
                const text = spans.value.map(extractSpanText).join('');
                const title: BookContentNode = {
                    node: 'title',
                    level,
                    lines: [text],
                };
                return yieldLast(title, spans.diagnostic);
            }
        case 'hr':
            {
                const separator: BookContentNode = {
                    node: 'separator',
                };
                return yieldLast(separator, expectEmptyContent(node.children));
            }
        case 'table':
            return tableNode(node, env);
        case 'ul':
        case 'ol':
            return listNode(node, env);
        default:
            return reject();
    }
}

function paragraphNode(node: XmlElement, env: Xml2NodesEnv) {
    const span = spanContent(node.children, env);
    if (span.success) {
        const pph: BookContentNode = makePph(span.value);
        return yieldLast(pph, span.diagnostic);
    } else {
        return groupNode(node, env);
    }
}

function groupNode(node: XmlElement, env: Xml2NodesEnv): SuccessLast<GroupNode> {
    const content = topLevelNodes(node.children, env);
    const group: BookContentNode = {
        node: 'group',
        nodes: content.value,
    };
    return yieldLast(group, content.diagnostic);
}

function buildRefId(filePath: string, id: string | undefined) {
    return id !== undefined
        ? `${filePath}#${id}`
        : undefined;
}
