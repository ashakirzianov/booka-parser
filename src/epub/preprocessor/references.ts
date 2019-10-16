import {
    BookNode, processNodes, refSpan, isRefSpan, isAnchorSpan,
    visitNodes, filterUndefined,
    Success, success, Diagnostic, compoundDiagnostic,
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
            if (isRefSpan(s)) {
                refs.push(s.refToId);
            } else if (isAnchorSpan(s)) {
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
            if (isRefSpan(span)) {
                if (ids.some(id => id === span.refToId)) {
                    const resolved = refMap[span.refToId];
                    if (resolved === undefined) {
                        diags.push({
                            diag: 'unexpected ref',
                            span,
                        });
                        return span;
                    } else {
                        return refSpan(span.ref, resolved);
                    }
                } else {
                    diags.push({
                        diag: 'missing ref',
                        severity: 'warning',
                        refToId: span.refToId,
                    });
                    return span.ref;
                }
            } else if (isAnchorSpan(span)) {
                const resolved = refMap[span.refId];
                if (resolved !== undefined) {
                    return { ...span, refId: resolved };
                } else {
                    return span.a;
                }
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
