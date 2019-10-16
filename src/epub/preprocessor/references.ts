import {
    BookNode, processNodes, visitNodes,
    Success, success, Diagnostic, compoundDiagnostic, isComplexSpan,
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
            if (!isComplexSpan(s)) {
                return undefined;
            }
            if (s.refToId) {
                refs.push(s.refToId);
            }
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
            return undefined;
        },
        node: n => {
            if (n.refId !== undefined) {
                if (ids.some(id => id === n.refId)) {
                    diags.push({
                        diag: 'duplicate id',
                        id: n.refId,
                        node: n,
                    });
                } else {
                    ids.push(n.refId);
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
            if (isComplexSpan(span)) {
                let result = { ...span };
                if (result.refId) {
                    const resolvedId = refMap[result.refId];
                    result = resolvedId !== undefined
                        ? { ...result, refId: resolvedId }
                        : { ...result, refId: undefined };
                }
                if (result.refToId && ids.some(id => id === result.refToId)) {
                    const resolved = refMap[result.refToId];
                    if (resolved === undefined) {
                        diags.push({
                            diag: 'unexpected ref',
                            result,
                        });
                    } else {
                        result = { ...result, refToId: resolved };
                    }
                } else if (result.refToId) {
                    diags.push({
                        diag: 'missing ref',
                        severity: 'warning',
                        refToId: result.refToId,
                    });
                    result = {
                        ...result,
                        refToId: undefined,
                    };
                }
                return result;
            } else {
                return span;
            }
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
