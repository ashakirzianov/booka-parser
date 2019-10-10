import { BookContentNode, iterateNodeIds, Span, mapSpan, flatten, justNodeGenerator } from 'booka-common';
import { SuccessLast, yieldLast, ParserDiagnostic } from '../combinators';

export function checkReferences(nodes: BookContentNode[]): SuccessLast<BookContentNode[]> {
    const diags: ParserDiagnostic[] = [];
    const nodeIds: string[] = [];
    const refs = extractRefsFromNodes(nodes);
    for (const node of justNodeGenerator(nodes)) {
        if (node.refId !== undefined) {
            if (!refs.some(ref => ref === node.refId)) {
                // NOTE: ugly mutation
                node.refId = undefined;
            } else {
                nodeIds.push(node.refId);
            }
        }
    }

    for (const ref of refs) {
        if (!nodeIds.some(id => id === ref)) {
            diags.push({
                diag: 'could not resolve ref',
                ref,
            });
        }
    }

    return yieldLast(nodes);
}

function extractRefsFromNodes(nodes: BookContentNode[]): string[] {
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
