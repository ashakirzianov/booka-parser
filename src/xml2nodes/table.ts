import {
    BookNode, TableRow, flatten, nodeSpans, TableCell,
    success, Success, Diagnostic, compoundDiagnostic, compoundSpan,
} from 'booka-common';
import { XmlElement } from '../xml';
import { Xml2NodesEnv, unexpectedNode, isTrailingWhitespace } from './common';
import { topLevelNodes } from './node';

export function tableNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    const tableData = tableBody(node, env);
    const rowsData = tableData.value;
    // If every row is single column we should treat table as a group
    if (rowsData.every(r => r.cells.length === 1)) {
        const content = flatten(rowsData.map(rowToGroup));
        return success(content, tableData.diagnostic);
    } else {
        const rows: TableRow[] = rowsData.map(
            row => ({
                kind: row.kind,
                cells: row.cells.map(cellDataToCell),
            })
        );
        const table: BookNode = {
            node: 'table',
            rows: rows,
        };
        return success([table], tableData.diagnostic);
    }
}

type TableRowData = {
    kind: TableRow['kind'],
    cells: TableCellData[],
};
function tableBody(bodyNode: XmlElement, env: Xml2NodesEnv): Success<TableRowData[]> {
    const diags: Diagnostic[] = [];
    const rows: TableRowData[] = [];
    for (const node of bodyNode.children) {
        if (isTrailingWhitespace(node)) {
            continue;
        }
        switch (node.name) {
            case 'tr':
                {
                    const cells = tableCells(node, env);
                    diags.push(cells.diagnostic);
                    rows.push({
                        kind: 'body',
                        cells: cells.value,
                    });
                }
                break;
            case 'tbody':
            case 'thead':
            case 'tfoot':
                {
                    const kind: TableRow['kind'] = node.name === 'tbody' ? 'body'
                        : node.name === 'thead' ? 'header'
                            : 'footer';
                    const body = tableBody(node, env);
                    diags.push(body.diagnostic);
                    rows.push(...body.value.map(row => ({
                        ...row,
                        kind: kind,
                    } as const)));
                }
                break;
            case 'caption': // TODO: do not ignore ?
            case 'kbd':
            case 'col':
            case 'colgroup':
                break;
            default:
                diags.push(unexpectedNode(node, 'table row'));
                break;
        }
    }
    return success(rows, compoundDiagnostic(diags));
}

type TableCellData = {
    colspan?: number,
    nodes: BookNode[],
};
function tableCells(rowNode: XmlElement, env: Xml2NodesEnv): Success<TableCellData[]> {
    const diags: Diagnostic[] = [];
    const cells: TableCellData[] = [];
    for (const node of rowNode.children) {
        if (isTrailingWhitespace(node)) {
            continue;
        }
        switch (node.name) {
            case 'th':
            case 'td':
                {
                    const colspan = node.attributes.colspan !== undefined
                        ? parseInt(node.attributes.colspan, 10)
                        : undefined;
                    const content = topLevelNodes(node.children, env);
                    diags.push(content.diagnostic);
                    cells.push({
                        colspan,
                        nodes: content.value,
                    });
                }
                break;
            case 'a':
                if (node.children.length !== 0) {
                    diags.push(unexpectedNode(node, 'table cell'));
                }
                break;
            default:
                diags.push(unexpectedNode(node, 'table cell'));
                break;
        }
    }

    return success(cells, compoundDiagnostic(diags));
}

function rowToGroup(row: TableRowData): BookNode[] {
    return flatten(row.cells.map(r => r.nodes));
}

function cellDataToCell(cell: TableCellData): TableCell {
    const spans = flatten(cell.nodes.map(nodeSpans));
    return cell.colspan !== undefined
        ? { width: cell.colspan, span: compoundSpan(spans) }
        : { span: compoundSpan(spans) };
}
