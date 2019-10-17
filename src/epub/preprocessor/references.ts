import {
    BookNode, processNodes, visitNodes,
    Success, success, Diagnostic, compoundDiagnostic, iterateBookNodeRefIds, Span,
} from 'booka-common';
import { PreprocessorArgs } from './preprocessor';

export async function references({ book }: PreprocessorArgs) {
    const { value: nodes, diagnostic } = checkNodesReferences(book.nodes);
    const resultBook = {
        ...book,
        nodes: nodes,
    };
    return success(resultBook, diagnostic);
}

function checkNodesReferences(nodes: BookNode[]): Success<BookNode[]> {
    const diags: Diagnostic[] = [];
    const ids: string[] = [];
    const refs: string[] = [];
    visitNodes(nodes, {
        span: s => {
            if (s.refId) {
                if (ids.some(id => id === s.refId)) {
                    diags.push({
                        diag: 'duplicate id',
                        id: s.refId,
                        span: s,
                    });
                } else {
                    ids.push(s.refId);
                }
            }
            if (s.node === 'ref') {
                refs.push(s.refToId);
            }

            return undefined;
        },
        node: nn => {
            for (const nodeRefId of iterateBookNodeRefIds(nn)) {
                if (ids.some(id => id === nodeRefId)) {
                    diags.push({
                        diag: 'duplicate id',
                        id: nodeRefId,
                        node: nn,
                    });
                } else {
                    ids.push(nodeRefId);
                }
            }

            return undefined;
        },
    });
    type RefMap = { [k: string]: string | undefined };
    const refMap = refs.reduce((map, ref, idx) => {
        map[ref] = `ref-${idx}`;
        return map;
    }, {} as RefMap);
    const processed = processNodes(nodes, {
        span: span => {
            if (span.node === undefined) {
                return span;
            }
            let result: Span = { ...span };
            if (result.refId) {
                const resolvedId = refMap[result.refId];
                result = resolvedId !== undefined
                    ? { ...result, refId: resolvedId }
                    : { ...result, refId: undefined };
            }
            if (result.node === 'ref') {
                const refToId = result.refToId;
                if (ids.some(id => id === refToId)) {
                    const resolved = refMap[result.refToId];
                    if (resolved === undefined) {
                        diags.push({
                            diag: 'unexpected ref',
                            result,
                        });
                    } else {
                        result = { ...result, refToId: resolved };
                    }
                } else if (refToId) {
                    diags.push({
                        diag: 'missing ref',
                        severity: 'warning',
                        refToId: result.refToId,
                    });
                    result = result.span;
                }
            }
            return result;
        },
        node: node => {
            if (node.refId !== undefined) {
                const resolved = refMap[node.refId];
                if (resolved !== undefined) {
                    return { ...node, refId: resolved };
                } else {
                    return { ...node, refId: undefined };
                }
            } else {
                return node;
            }
        },
    });

    return success(processed, compoundDiagnostic(diags));
}
