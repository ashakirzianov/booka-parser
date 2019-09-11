import { RawBookNode, FootnoteSpan, SpanNode } from 'booka-common';
import { spanFromRawNode } from './common';
import {
    SuccessLast, ParserDiagnostic, success, compoundDiagnostic,
} from '../combinators';

export function resolveReferences(nodes: RawBookNode[]): SuccessLast<RawBookNode[]> {
    const r1 = swipe1(nodes, [], []);
    const r2 = swipe2(r1.value.rest, r1.value.footnotes);

    return r2;
}

function swipe1(nodes: RawBookNode[], refs: string[], ids: string[]): SuccessLast<{
    rest: RawBookNode[],
    footnotes: RawBookNode[],
}> {
    const footnotes: RawBookNode[] = [];
    const rest: RawBookNode[] = [];
    const diags: ParserDiagnostic[] = [];
    for (const node of nodes) {
        let nodeToInsert: RawBookNode | undefined = node;
        if (node.ref) {
            ids.push(node.ref);
        }

        switch (node.node) {
            case 'ref':
                if (node.to && !ids.some(id => id === node.to)) {
                    refs.push(node.to);
                } else {
                    nodeToInsert = undefined;
                }
                break;
            case 'compound-raw':
                {
                    const inside = swipe1(node.nodes, refs, ids);
                    footnotes.push(...inside.value.footnotes);
                    nodeToInsert = {
                        ...node,
                        nodes: inside.value.rest,
                    };
                    diags.push(inside.diagnostic);
                }
                break;
            case 'attr':
                {
                    const inside = swipe1([node.content], refs, ids);
                    footnotes.push(...inside.value.footnotes);
                    nodeToInsert = {
                        ...node,
                        content: {
                            node: 'compound-raw',
                            nodes: inside.value.rest,
                        },
                    };
                    diags.push(inside.diagnostic);
                }
                break;
        }

        if (nodeToInsert) {
            const isFootnote = refs.some(r => r === node.ref);
            if (isFootnote) {
                footnotes.push(nodeToInsert);
            } else {
                rest.push(nodeToInsert);
            }
        }

    }

    return success({ rest, footnotes }, undefined, compoundDiagnostic(diags));
}

function swipe2(nodes: RawBookNode[], footnotes: RawBookNode[]): SuccessLast<RawBookNode[]> {
    const result: RawBookNode[] = [];
    const diags: ParserDiagnostic[] = [];
    for (const node of nodes) {
        const r = swipe2node(node, footnotes);
        result.push(...r.value);
        diags.push(r.diagnostic);
    }

    return success(result, undefined, compoundDiagnostic(diags));
}

function swipe2node(node: RawBookNode, footnotes: RawBookNode[]): SuccessLast<RawBookNode[]> {
    if (node.node === 'ref') {
        const content = spanFromRawNode(node.content);
        if (!content.success) {
            return success([], undefined, { custom: 'couldnt-build-span', node, context: 'footnote' });
        }
        const footnoteNode = footnotes.find(f => f.ref === node.to);
        if (!footnoteNode) {
            return success([], undefined, { custom: 'couldnt-resolve-footnote', node });
        }
        // Resolve footnote from footnote:
        const resolved = swipe2node(footnoteNode, footnotes);
        const titles = [] as string[];
        const footnote = spanFromRawNode(resolved.value[0], titles);
        if (!footnote.success) {
            return success([], undefined, { custom: 'couldnt-build-footnote', nodes: resolved.value });
        }
        const footnoteSpan: FootnoteSpan = {
            span: 'note',
            content: content.success ? content.value : '*',
            footnote: footnote.value,
            title: [],
            id: node.to,
        };
        const spanNode: SpanNode = {
            node: 'span',
            span: footnoteSpan,
        };
        const diag = compoundDiagnostic([content.diagnostic, resolved.diagnostic, footnote.diagnostic]);
        return success([spanNode], undefined, diag);
    } else if (node.node === 'compound-raw') {
        const inside = swipe2(node.nodes, footnotes);
        return success([{
            ...node,
            nodes: inside.value,
        }]);
    } else if (node.node === 'attr') {
        const inside = swipe2([node.content], footnotes);
        return success([{
            ...node,
            content: inside.value[0],
        }]);
    } else {
        return success([node]);
    }
}
