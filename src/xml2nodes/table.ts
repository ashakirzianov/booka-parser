import {
    BookNode, TableRow, flatten, Span, extractSpans, TableCell,
} from 'booka-common';
import { XmlElement, Xml } from '../xml';
import {
    yieldLast, SuccessLast,
} from '../combinators';
import { Xml2NodesEnv, unexpectedNode, processNodes } from './common';
import { topLevelNodes } from './node';
import { isWhitespaces } from '../utils';

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
                cells: row.map(cellDataToCell),
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
            case 'thead':
            case 'tfoot':
                {
                    const rows = tableRows(node.children, env);
                    return { values: rows.value, diag: rows.diagnostic };
                }
            case 'caption': // TODO: do not ignore ?
            case 'kbd':
            case 'col':
            case 'colgroup':
                return {};
            default:
                return { diag: unexpectedNode(node, 'table row') };
        }
    });
}

type TableCellData = {
    colspan?: number,
    nodes: BookNode[],
};
function tableCells(nodes: Xml[], env: Xml2NodesEnv): SuccessLast<TableCellData[]> {
    return processNodes(nodes, env, node => {
        switch (node.name) {
            case 'th':
            case 'td':
                {
                    const colspan = node.attributes.colspan !== undefined
                        ? parseInt(node.attributes.colspan, 10)
                        : undefined;
                    const content = topLevelNodes(node.children, env);
                    return {
                        values: [{
                            nodes: content.value,
                            colspan,
                        }],
                        diag: content.diagnostic,
                    };
                }
            case 'a':
                return node.children.length === 0
                    ? {}
                    : { diag: unexpectedNode(node, 'table cell') };
            case undefined:
                return node.type === 'text' && isWhitespaces(node.text)
                    ? {}
                    : { diag: unexpectedNode(node, 'table cell') };
            default:
                return { diag: unexpectedNode(node, 'table cell') };
        }
    });
}

function rowToGroup(row: TableRowData): BookNode {
    const group: BookNode = {
        node: 'group',
        nodes: flatten(row.map(r => r.nodes)),
    };
    return group;
}

function cellDataToCell(cell: TableCellData): TableCell {
    const spans = flatten(cell.nodes.map(extractSpans));
    return cell.colspan !== undefined
        ? { width: cell.colspan, spans }
        : { spans };
}
