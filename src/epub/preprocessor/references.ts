import {
    BookNode, justNodeGenerator, mapSpan, Span, flatten, processNodes, refSpan, isRefSpan,
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
    const nodeIds: string[] = [];
    const refs = extractRefsFromNodes(nodes);
    type RefMap = { [k: string]: string | undefined };
    const refMap = refs.reduce((map, ref, idx) => {
        map[ref] = `ref-${idx}`;
        return map;
    }, {} as RefMap);
    const processed = processNodes(nodes, {
        span: span => {
            if (isRefSpan(span)) {
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
                return span;
            }
        },
        node: node => {
            if (node.refId !== undefined) {
                if (nodeIds.some(id => id === node.refId)) {
                    diags.push({
                        diag: 'duplicate id',
                        id: node.refId,
                    });
                }
                nodeIds.push(node.refId);
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

    for (const ref of refs) {
        if (!nodeIds.some(id => id === ref)) {
            diags.push({
                diag: 'could not resolve ref',
                ref,
            });
        }
    }

    return yieldLast(processed, compoundDiagnostic(diags));
}

function extractRefsFromNodes(nodes: BookNode[]): string[] {
    const refs: string[] = [];
    for (const node of justNodeGenerator(nodes)) {
        switch (node.node) {
            case 'pph':
                refs.push(...extractRefsFromSpan(node.span));
                break;
        }
    }

    return refs;
}

function extractRefsFromSpan(span: Span): string[] {
    return mapSpan(span, {
        compound: spans => flatten(spans.map(extractRefsFromSpan)),
        ref: (_, ref) => [ref],
        default: () => [],
    });
}
