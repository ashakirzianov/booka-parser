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

    return expectNodes(body.children, env);
}

function expectNodes(nodes: XmlTree[], env: Env): SuccessLast<BookContentNode[]> {
    const results: BookContentNode[] = [];
    const diags: ParserDiagnostic[] = [];
    let spans: Span[] = [];
    for (let idx = 0; idx < nodes.length; idx++) {
        const node = nodes[idx];
        // Ignore if not in context of span
        if (spans.length === 0 && shouldIgnore(node)) {
            continue;
        }
        const span = singleSpan(node, env);
        if (span.success) {
            spans.push(span.value);
            diags.push(span.diagnostic);
        } else {
            if (spans.length > 0) {
                const pph = makePph(compoundSpan(spans));
                results.push(pph);
                spans = [];
            }
            const nodeResult = singleElementNode(node, env);
            if (nodeResult.success) {
                results.push(nodeResult.value);
                diags.push(nodeResult.diagnostic);
            } else if (shouldIgnore(node)) {
                continue;
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

// TODO: assign ids
// TODO: assign semantics
// TODO: report attrs ?
function singleElementNode(node: XmlTree, env: Env): ResultLast<BookContentNode> {
    if (node.type !== 'element') {
        return reject();
    }

    switch (node.name) {
        //  case 'span':
        case 'p':
            {
                const span = spanContent(node.children, env);
                if (span.success) {
                    const pph: BookContentNode = makePph(span.value);
                    return yieldLast(pph, span.diagnostic);
                } else {
                    return groupContent(node.children, env);
                }
            }
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
            {
                const level = 4 - parseInt(node.name[1], 10);
                const spans = expectSpanContent(node.children, env);
                const text = extractSpanText(spans.value);
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
        case 'span':
        case 'div':
            return groupContent(node.children, env);
        case 'table':
            {
                const rows = tableContent(node.children, env);
                const table: BookContentNode = {
                    node: 'table',
                    rows: rows.value,
                };
                return yieldLast(table, rows.diagnostic);
            }
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

function groupContent(nodes: XmlTree[], env: Env): SuccessLast<GroupNode> {
    const content = expectNodes(nodes, env);
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
                const span = expectSpanContent(node.children, env);
                return yieldLast(
                    { item: span },
                    span.diagnostic,
                );
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
                const span = expectSpanContent(node.children, env);
                return span;
            }
        default:
            return reject();
    }
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

// Parsers:

// const skipNewLineElement: SingleNodeParser = headParser(node => {
//     if (node.type === 'text' && node.text.startsWith('\n') && isWhitespaces(node.text)) {
//         return yieldLast({ node: 'ignore' });
//     } else {
//         return reject();
//     }
// });
// const element: SingleNodeParser = headParser(singleElementNode);
// const plainSpans = oneOrMore(headParser(singleSpan));
// const plainParagraph: SingleNodeParser = stream => {
//     const result = plainSpans(stream);
//     if (result.success) {
//         const span = compoundSpan(result.value);
//         return yieldLast(makePph(span), result.diagnostic);
//     } else {
//         return result;
//     }
// };
// const report: SingleNodeParser = headParser(node =>
//     yieldLast({ node: 'ignore' }, unexpectedNode(node)),
// );
// const singleTopLevel = choice(
//     skipNewLineElement,
//     plainParagraph,
//     element,
//     report,
// );
// const topLevel = some(singleTopLevel);

// function expectNodes(nodes: XmlTree[], env: Env): SuccessLast<BookContentNode[]> {
//     const stream = makeStream(nodes, env);
//     const result = topLevel(stream);
//     const content = result.value.filter(isContent);
//     const tail = result.next
//         ? result.next.stream
//         : [];
//     const diag = expectEmptyContent(tail);
//     return yieldLast(content, diag);
// }
