import {
    VolumeNode, ContentNode,
    Span, AttributeName, ParagraphNode, CompoundSpan,
} from '../common/bookFormat';
import { logger } from '../log';
import {
    isChapter, isParagraph, paragraphNode, isSimple,
    isAttributed, isFootnote, compoundSpan, isCompound,
    assertNever,
} from '../utils';

export function optimizeVolume(book: VolumeNode): VolumeNode {
    const optimized = {
        ...book,
        nodes: optimizeNodes(book.nodes),
    };

    const before = JSON.stringify(book).length;
    const after = JSON.stringify(optimized).length;
    const won = Math.floor((before - after) / before * 100);
    const length = Math.floor(after / 1000);
    logger().info(`Optimized by ${won}%, length: ${length}kCh`);

    return optimized;
}

function optimizeNodes(nodes: ContentNode[]) {
    return nodes.map(optimizeNode);
}

function optimizeNode(node: ContentNode): ContentNode {
    if (isChapter(node)) {
        return {
            ...node,
            nodes: optimizeNodes(node.nodes),
        };
    } else if (isParagraph(node)) {
        return optimizeParagraph(node);
    } else {
        return assertNever(node);
    }
}

function optimizeParagraph(p: ParagraphNode): ContentNode {
    const optimized = optimizeSpan(p.span);

    // Handle case of single string attributed with 'line'
    // (this is same as just a string paragraph)
    // if (isAttributed(optimized)) {
    //     if (optimized.content.length === 1) {
    //         if (!optimized.attrs || (optimized.attrs.length === 1 && optimized.attrs[0] === 'line')) {
    //             return createParagraph(optimized.content[0]);
    //         }
    //     }
    // }
    return paragraphNode(optimized);
}

function optimizeSpan(span: Span): Span {
    if (isSimple(span)) {
        return span;
    } else if (isAttributed(span)) {
        const optimizedContent = optimizeSpan(span.content);
        return {
            ...span,
            content: optimizedContent,
        };
    } else if (isFootnote(span)) {
        const content = optimizeSpan(span.content);
        const footnote = optimizeSpan(span.footnote);
        return {
            ...span,
            content,
            footnote,
        };
    } else if (isCompound(span)) {
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
            if (isSimple(prev)) {
                if (isSimple(optimized)) {
                    toReplace = prev + optimized;
                }
            } else if (isAttributed(prev)) {
                if (isAttributed(optimized) && sameAttrs(prev.attrs, optimized.attrs)) {
                    toReplace = compoundSpan([prev.content, optimized.content]);
                }
            } else if (isCompound(prev) && isCompound(optimized)) {
                toReplace = compoundSpan([prev, optimized]);
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
        return compoundSpan(spans);
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
