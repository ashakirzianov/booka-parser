import {
    makePph, extractSpanText, BookContentNode, TableRow, TableCell, flatten, ListItem, compoundSpan, Span, GroupNode,
} from 'booka-common';
import { XmlTree, XmlTreeElement, XmlTreeDocument, tree2String } from '../xmlStringParser';
import {
    ParserDiagnostic, ResultLast, SuccessLast,
    reject, yieldLast, compoundDiagnostic,
} from '../combinators';
import { Env, unexpectedNode, expectEmptyContent, isWhitespaceNode } from './base';
import { expectSpanContent, singleSpan, spanContent } from './span';
import { isWhitespaces } from '../utils';

// Functions:

export function documentParser(document: XmlTreeDocument, env: Env): SuccessLast<BookContentNode[]> {
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

function topLevelNodes(nodes: XmlTree[], env: Env): SuccessLast<BookContentNode[]> {
    const results: BookContentNode[] = [];
    const diags: ParserDiagnostic[] = [];
    for (let idx = 0; idx < nodes.length; idx++) {
        let node = nodes[idx];
        // Ignore some nodes
        if (shouldIgnore(node)) {
            continue;
        }
        // Try parse top-level node
        const nodeResult = singleElementNode(node, env);
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
function singleElementNode(node: XmlTree, env: Env): ResultLast<BookContentNode> {
    if (node.type !== 'element') {
        return reject();
    }

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
            {
                const items = listContent(node.children, env);
                const list: BookContentNode = {
                    node: 'list',
                    kind: node.name === 'ol'
                        ? 'ordered'
                        : 'basic',
                    items: items.value,
                };
                return yieldLast(list, items.diagnostic);
            }
        default:
            return reject();
    }
}

function paragraphNode(node: XmlTreeElement, env: Env) {
    const span = spanContent(node.children, env);
    if (span.success) {
        const pph: BookContentNode = makePph(span.value);
        return yieldLast(pph, span.diagnostic);
    } else {
        return groupNode(node, env);
    }
}

function groupNode(node: XmlTreeElement, env: Env): SuccessLast<GroupNode> {
    const content = topLevelNodes(node.children, env);
    const group: BookContentNode = {
        node: 'group',
        nodes: content.value,
    };
    return yieldLast(group, content.diagnostic);
}

function listContent(nodes: XmlTree[], env: Env): SuccessLast<ListItem[]> {
    return reportUnexpected(nodes, env, listItem);
}

function listItem(node: XmlTreeElement, env: Env): ResultLast<ListItem> {
    switch (node.name) {
        case 'li':
            {
                const span = itemContent(node.children, env);
                return yieldLast(
                    { spans: span.value },
                    span.diagnostic,
                );
            }
        default:
            return reject();
    }
}

function tableNode(node: XmlTreeElement, env: Env): SuccessLast<BookContentNode> {
    const asGroup = tableAsGroup(node, env);
    if (asGroup.success) {
        return asGroup;
    } else {
        const rows = tableContent(node.children, env);
        const table: BookContentNode = {
            node: 'table',
            rows: rows.value,
        };
        return yieldLast(table, rows.diagnostic);
    }
}

function tableAsGroup(node: XmlTreeElement, env: Env): ResultLast<BookContentNode> {
    const [pre, bodyNode, post, ...rest] = node.children;
    if (rest.length !== 0 || bodyNode.type !== 'element') {
        return reject();
    }

    switch (bodyNode.name) {
        case 'tbody':
        case 'tr':
            return tableAsGroup(bodyNode, env);
        case 'td':
            {
                const inside = topLevelNodes(bodyNode.children, env);

                const group: BookContentNode = {
                    node: 'group',
                    nodes: inside.value,
                };
                return yieldLast(group, inside.diagnostic);
            }
        default:
            return reject();
    }
}

function tableContent(nodes: XmlTree[], env: Env): SuccessLast<TableRow[]> {
    const rss = reportUnexpected(nodes, env, tableRowOrBody);
    const rows = flatten(rss.value);
    return yieldLast(rows, rss.diagnostic);
}

function tableRowOrBody(node: XmlTreeElement, env: Env): ResultLast<TableRow[]> {
    switch (node.name) {
        case 'tr':
            {
                const cells = reportUnexpected(node.children, env, tableCell);
                return yieldLast(
                    [{ cells: cells.value }],
                    cells.diagnostic,
                );
            }
        case 'tbody':
            {
                return tableContent(node.children, env);
            }
        default:
            return reject();
    }
}

function tableCell(node: XmlTreeElement, env: Env): ResultLast<TableCell> {
    switch (node.name) {
        case 'th':
        case 'td':
            {
                const spans = itemContent(node.children, env);
                return yieldLast(
                    { spans: spans.value },
                    spans.diagnostic,
                );
            }
        default:
            return reject();
    }
}

function itemContent(nodes: XmlTree[], env: Env): SuccessLast<Span[]> {
    const spans = spanContent(nodes, env);
    if (spans.success) {
        return spans;
    }

    const diags: ParserDiagnostic[] = [];
    const results: Span[] = [];
    for (const node of nodes) {
        if (shouldIgnore(node)) {
            continue;
        }

        switch (node.name) {
            case 'p':
            case 'div':
                {
                    const inside = itemContent(node.children, env);
                    diags.push(inside.diagnostic);
                    results.push(...inside.value);
                }
                break;
            case 'br':
                results.push('\n');
                break;
            default:
                diags.push(unexpectedNode(node, 'item content'));
                break;

        }
    }

    return yieldLast(results, compoundDiagnostic(diags));
}

function reportUnexpected<T>(nodes: XmlTree[], env: Env, fn: (node: XmlTreeElement, env: Env) => ResultLast<T>): SuccessLast<T[]> {
    const diags: ParserDiagnostic[] = [];
    const results: T[] = [];
    for (const node of nodes) {
        if (isWhitespaceNode(node)) {
            continue;
        } else if (node.type !== 'element') {
            diags.push(unexpectedNode(node));
        } else {
            const result = fn(node, env);
            if (result.success) {
                diags.push(result.diagnostic);
                results.push(result.value);
            } else {
                diags.push(unexpectedNode(node));
            }
        }
    }

    return yieldLast(results, compoundDiagnostic(diags));
}

function shouldIgnore(node: XmlTree): boolean {
    switch (node.type) {
        case 'text':
            return node.text.startsWith('\n') && isWhitespaces(node.text);
        case 'element':
            switch (node.name) {
                case 'svg':
                    return true;
                default:
                    return false;
            }
        default:
            return false;
    }
}
