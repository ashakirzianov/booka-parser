import { RawBookNode, FootnoteSpan, SpanNode } from 'booka-common';
import { ParserDiagnoser } from '../log';
import { spanFromRawNode } from './common';

export function resolveReferences(nodes: RawBookNode[], ds: ParserDiagnoser): RawBookNode[] {
    const { rest, footnotes } = swipe1(nodes, [], [], ds);
    const result = swipe2(rest, footnotes, ds);

    return result;
}

function swipe1(nodes: RawBookNode[], refs: string[], ids: string[], ds: ParserDiagnoser): {
    rest: RawBookNode[],
    footnotes: RawBookNode[],
} {
    const footnotes: RawBookNode[] = [];
    const rest: RawBookNode[] = [];
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
                    const inside = swipe1(node.nodes, refs, ids, ds);
                    footnotes.push(...inside.footnotes);
                    nodeToInsert = {
                        ...node,
                        nodes: inside.rest,
                    };
                }
                break;
            case 'attr':
                {
                    const inside = swipe1([node.content], refs, ids, ds);
                    footnotes.push(...inside.footnotes);
                    nodeToInsert = {
                        ...node,
                        content: {
                            node: 'compound-raw',
                            nodes: inside.rest,
                        },
                    };
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

    return { rest, footnotes };
}

function swipe2(nodes: RawBookNode[], footnotes: RawBookNode[], ds: ParserDiagnoser): RawBookNode[] {
    const result: RawBookNode[] = [];
    for (const node of nodes) {
        if (node.node === 'ref') {
            const content = spanFromRawNode(node.content, ds);
            if (!content) {
                ds.add({ diag: 'couldnt-build-span', node, context: 'footnote' });
            }
            const footnoteNode = footnotes.find(f => f.ref === node.to);
            // Resolve footnote from footnote:
            const resolved = footnoteNode && swipe2([footnoteNode], footnotes, ds);
            const titles = [] as string[];
            const footnote = resolved && spanFromRawNode(resolved[0], ds, titles);
            if (footnote) {
                const footnoteSpan: FootnoteSpan = {
                    span: 'note',
                    content: content || '*',
                    footnote: footnote,
                    title: [],
                    id: node.to,
                };
                const spanNode: SpanNode = {
                    node: 'span',
                    span: footnoteSpan,
                };
                result.push(spanNode);
            } else {
                ds.add({ diag: 'couldnt-resolve-ref', id: node.to, context: 'footnote' });
            }
        } else if (node.node === 'compound-raw') {
            const inside = swipe2(node.nodes, footnotes, ds);
            result.push({
                ...node,
                nodes: inside,
            });
        } else if (node.node === 'attr') {
            const inside = swipe2([node.content], footnotes, ds);
            result.push({
                ...node,
                content: inside[0],
            });
        } else {
            result.push(node);
        }
    }

    return result;
}
