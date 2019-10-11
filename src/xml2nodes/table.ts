import {
    BookNode, TableRow, flatten, Span, extractSpans,
} from 'booka-common';
import { XmlElement, Xml } from '../xml';
import {
    yieldLast, SuccessLast,
} from '../combinators';
import { Xml2NodesEnv, unexpectedNode, processNodes } from './common';
import { topLevelNodes } from './node';

export function tableNode(node: XmlElement, env: Xml2NodesEnv): SuccessLast<BookNode> {
    const tableData = tableRows(node.children, env);
    const rowsData = tableData.value;
    // If every row is single column we should treat table as a group
    if (rowsData.every(r => r.length === 1)) {
        const groups = rowsData.map(rowToGroup);
        const group: BookNode = {
            node: 'group',
            nodes: groups,
        };
        return yieldLast(group, tableData.diagnostic);
    } else {
        const rows: TableRow[] = rowsData.map(
            row => ({
                cells: row.map(c => ({
                    spans: cellToSpans(c),
                })),
            })
        );
        const table: BookNode = {
            node: 'table',
            rows: rows,
        };
        return yieldLast(table, tableData.diagnostic);
    }
}

type TableRowData = TableCellData[];
function tableRows(nodes: Xml[], env: Xml2NodesEnv): SuccessLast<TableRowData[]> {
    return processNodes(nodes, env, node => {
        switch (node.name) {
            case 'tr':
                {
                    const row = tableCells(node.children, env);
                    return { values: [row.value], diag: row.diagnostic };
                }
            case 'tbody':
                {
                    const rows = tableRows(node.children, env);
                    return { values: rows.value, diag: rows.diagnostic };
                }
            default:
                return { diag: unexpectedNode(node, 'table row') };
        }
    });
}

type TableCellData = BookNode[];
function tableCells(nodes: Xml[], env: Xml2NodesEnv): SuccessLast<TableCellData[]> {
    return processNodes(nodes, env, node => {
        switch (node.name) {
            case 'th':
            case 'td':
                {
                    const content = topLevelNodes(node.children, env);
                    return {
                        values: [content.value],
                        diag: content.diagnostic,
                    };
                }
            default:
                return { diag: unexpectedNode(node, 'table cell') };
        }
    });
}

function rowToGroup(row: TableRowData): BookNode {
    const group: BookNode = {
        node: 'group',
        nodes: flatten(row),
    };
    return group;
}

function cellToSpans(cell: TableCellData): Span[] {
    return flatten(
        cell.map(extractSpans)
    );
}
