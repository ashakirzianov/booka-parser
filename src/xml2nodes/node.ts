import {
    Span, GroupNode, BookContentNode,
    makePph, extractSpanText, compoundSpan,
} from 'booka-common';
import {
    XmlTree, XmlTreeElement, XmlTreeDocument, tree2String,
} from '../xmlStringParser';
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

// Functions:

export function documentParser(document: XmlTreeDocument, env: Xml2NodesEnv): SuccessLast<BookContentNode[]> {
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        return yieldLast([], {
            diag: 'no-html',
            xml: tree2String(document),
        });
    }
    const body = html.children
        .find(n => n.name === 'body');
    if (body === undefined || body.type !== 'element') {
        return yieldLast([], {
            diag: 'no-body',
            xml: tree2String(html),
        });
    }

    return topLevelNodes(body.children, env);
}

export function topLevelNodes(nodes: XmlTree[], env: Xml2NodesEnv): SuccessLast<BookContentNode[]> {
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

// TODO: assign ids
// TODO: assign semantics
// TODO: report attrs ?
function singleNode(node: XmlTree, env: Xml2NodesEnv): ResultLast<BookContentNode> {
    switch (node.name) {
        case 'blockquote': // TODO: assign quote semantic
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

function paragraphNode(node: XmlTreeElement, env: Xml2NodesEnv) {
    const span = spanContent(node.children, env);
    if (span.success) {
        const pph: BookContentNode = makePph(span.value);
        return yieldLast(pph, span.diagnostic);
    } else {
        return groupNode(node, env);
    }
}

function groupNode(node: XmlTreeElement, env: Xml2NodesEnv): SuccessLast<GroupNode> {
    const content = topLevelNodes(node.children, env);
    const group: BookContentNode = {
        node: 'group',
        nodes: content.value,
    };
    return yieldLast(group, content.diagnostic);
}
