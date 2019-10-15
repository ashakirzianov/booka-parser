import {
    BookNode, processNodes, refSpan, isRefSpan, isAnchorSpan,
    visitNodes, filterUndefined,
} from 'booka-common';
import {
    SuccessLast, yieldLast, ParserDiagnostic, compoundDiagnostic,
} from '../../combinators';
import { PreprocessorArgs } from './preprocessor';

export async function references({ book }: PreprocessorArgs) {
    const { value: nodes, diagnostic } = checkNodesReferences(book.nodes);
    const resultBook = {
        ...book,
        nodes: nodes,
    };
    return yieldLast(resultBook, diagnostic);
}

function checkNodesReferences(nodes: BookNode[]): SuccessLast<BookNode[]> {
    const diags: ParserDiagnostic[] = [];
    const idsAndRefs = visitNodes(nodes, {
        span: s => {
            if (isRefSpan(s)) {
                return { ref: s.refToId, id: undefined };
            } else if (isAnchorSpan(s)) {
                return { id: s.refId, ref: undefined };
            } else {
                return {};
            }
        },
        node: n => {
            return { id: n.refId, ref: undefined };
        },
    });
    const ids = filterUndefined(idsAndRefs.map(x => x.id));
    const refs = filterUndefined(idsAndRefs.map(x => x.ref));
    diags.push(reportDuplicateIds(ids));
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

    return yieldLast(processed, compoundDiagnostic(diags));
}

function reportDuplicateIds(ids: string[]): ParserDiagnostic {
    const diags: ParserDiagnostic[] = [];
    const already: string[] = [];
    for (const id of ids) {
        if (already.some(i => i === id)) {
            diags.push({
                diag: 'duplicate id',
                id,
            });
        } else {
            already.push(id);
        }
    }
    return compoundDiagnostic(diags);
}
