import {
    BookNode, processNodes, iterateNodeSpans,
    Success, success, Diagnostic, compoundDiagnostic, iterateNodeRefIds, Span, iterateNodes, processNodeSpans,
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
    const refData = collectRefData(nodes);
    diags.push(refData.diagnostic);

    const processed = checkAndResolveRefs(nodes, refData.value);
    diags.push(processed.diagnostic);

    return success(processed.value, compoundDiagnostic(diags));
}

type RefData = {
    refs: string[],
    ids: string[],
};
function collectRefData(nodes: BookNode[]): Success<RefData> {
    const diags: Diagnostic[] = [];
    const ids: string[] = [];
    const refs: string[] = [];
    for (const [node] of iterateNodes(nodes)) {
        for (const [span] of iterateNodeSpans(node)) {
            if (span.refId) {
                if (ids.some(id => id === span.refId)) {
                    diags.push({
                        diag: 'duplicate id',
                        id: span.refId,
                        span: span,
                    });
                } else {
                    ids.push(span.refId);
                }
            }
            if (span.span === 'ref') {
                refs.push(span.refToId);
            }
        }
        for (const nodeRefId of iterateNodeRefIds(node)) {
            if (ids.some(id => id === nodeRefId)) {
                diags.push({
                    diag: 'duplicate id',
                    id: nodeRefId,
                    node: node,
                });
            } else {
                ids.push(nodeRefId);
            }
        }
    }

    return success({ refs, ids }, compoundDiagnostic(diags));
}

function checkAndResolveRefs(nodes: BookNode[], { refs, ids }: RefData): Success<BookNode[]> {
    const diags: Diagnostic[] = [];

    type RefMap = { [k: string]: string | undefined };
    const refMap = refs.reduce((map, ref, idx) => {
        map[ref] = `ref-${idx}`;
        return map;
    }, {} as RefMap);

    const processed = processNodes(nodes, node => {
        if (node.refId !== undefined) {
            const resolved = refMap[node.refId];
            node = resolved !== undefined
                ? { ...node, refId: resolved }
                : { ...node, refId: undefined };
        }
        node = processNodeSpans(node, span => {
            if (span.span === undefined) {
                return span;
            }
            let result: Span = { ...span };
            if (result.refId) {
                const resolvedId = refMap[result.refId];
                result = resolvedId !== undefined
                    ? { ...result, refId: resolvedId }
                    : { ...result, refId: undefined };
            }
            if (result.span === 'ref') {
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
                } else {
                    diags.push({
                        diag: 'missing ref',
                        severity: 'warning',
                        refToId: result.refToId,
                    });
                    result = result.content;
                }
            }
            return result;
        });

        return node;
    });

    return success(processed, compoundDiagnostic(diags));
}
