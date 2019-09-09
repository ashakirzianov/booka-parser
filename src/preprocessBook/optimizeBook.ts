import {
    VolumeNode, BookContentNode,
    Span, AttributeName, ParagraphNode, CompoundSpan,
    isChapter, isParagraph, isImage,
    isSimpleSpan, isAttributedSpan, isFootnoteSpan, isCompoundSpan, isSemanticSpan, Book,
} from 'booka-common';
import { assertNever } from '../utils';

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
    if (isChapter(node)) {
        return {
            ...node,
            nodes: optimizeNodes(node.nodes),
        };
    } else if (isParagraph(node)) {
        return optimizeParagraph(node);
    } else if (isImage(node)) {
        return node;
    } else {
        assertNever(node);
        return node;
    }
}

function optimizeParagraph(p: ParagraphNode): BookContentNode {
    const optimized = optimizeSpan(p.span);

    return {
        node: 'paragraph',
        span: optimized,
    };
}

function optimizeSpan(span: Span): Span {
    if (isSimpleSpan(span)) {
        return span;
    } else if (isAttributedSpan(span) || isSemanticSpan(span)) {
        const optimizedContent = optimizeSpan(span.content);
        return {
            ...span,
            content: optimizedContent,
        };
    } else if (isFootnoteSpan(span)) {
        const content = optimizeSpan(span.content);
        const footnote = optimizeSpan(span.footnote);
        return {
            ...span,
            content,
            footnote,
        };
    } else if (isCompoundSpan(span)) {
        return optimizeCompound(span);
    } else {
        return assertNever(span);
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
                        span: 'compound',
                        spans: [prev.content, optimized.content],
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
