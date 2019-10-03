import {
    VolumeNode, BookContentNode,
    Span, AttributeName, ParagraphNode, CompoundSpan,
    isSimpleSpan, isAttributedSpan, isRefSpan, isCompoundSpan, Book, assertNever,
} from 'booka-common';

export function optimizeBook(book: Book): Book {
    const volume = optimizeVolume(book.volume);
    return {
        ...book,
        volume,
    };
}

function optimizeVolume(volume: VolumeNode): VolumeNode {
    const optimized = {
        ...volume,
        nodes: optimizeNodes(volume.nodes),
    };

    return optimized;
}

function optimizeNodes(nodes: BookContentNode[]) {
    return nodes.map(optimizeNode);
}

function optimizeNode(node: BookContentNode): BookContentNode {
    switch (node.node) {
        case 'chapter':
            return {
                ...node,
                nodes: optimizeNodes(node.nodes),
            };
        case undefined:
            return optimizeParagraph(node);
        case 'group':
        case 'table':
        case 'list':
            return node;
        case 'image-ref':
        case 'image-data':
        case 'separator':
            return node;
        default:
            assertNever(node);
            return node;
    }
}

function optimizeParagraph(p: ParagraphNode): BookContentNode {
    return optimizeSpan(p);
}

function optimizeSpan(span: Span): Span {
    if (isSimpleSpan(span)) {
        return span;
    } else if (isAttributedSpan(span) || isRefSpan(span)) {
        const optimizedContent = optimizeSpan(span.content);
        return {
            ...span,
            content: optimizedContent,
        };
    } else if (isCompoundSpan(span)) {
        return optimizeCompound(span);
    } else {
        assertNever(span);
        return span;
    }
}

function optimizeCompound(compound: CompoundSpan): Span {
    const spans = compound.spans.reduce((res, curr, idx) => {
        const optimized = optimizeSpan(curr);
        if (res.length > 0) {
            const prev = res[res.length - 1];
            let toReplace: Span | undefined;
            if (isSimpleSpan(prev)) {
                if (isSimpleSpan(optimized)) {
                    toReplace = prev + optimized;
                }
            } else if (isAttributedSpan(prev)) {
                if (isAttributedSpan(optimized) && sameAttrs(prev.attrs, optimized.attrs)) {
                    toReplace = {
                        span: 'attrs',
                        attrs: prev.attrs,
                        content: {
                            span: 'compound',
                            spans: [prev.content, optimized.content],
                        },
                    };
                }
            } else if (isCompoundSpan(prev) && isCompoundSpan(optimized)) {
                toReplace = {
                    span: 'compound',
                    spans: [prev, optimized],
                };
            }

            if (toReplace === undefined) {
                res.push(optimized);
            } else {
                res[res.length - 1] = toReplace;
            }
        } else {
            res[0] = optimized;
        }
        return res;
    }, [] as Span[]);

    if (spans.length === 1) {
        return spans[0];
    } else {
        return {
            span: 'compound',
            spans: spans,
        };
    }
}

function sameAttrs(left: AttributeName[] | undefined, right: AttributeName[] | undefined): boolean {
    if (left === undefined || right === undefined) {
        return left === right;
    } else {
        return left.length === right.length
            && left.every(l => right.some(r => r === l));
    }
}
