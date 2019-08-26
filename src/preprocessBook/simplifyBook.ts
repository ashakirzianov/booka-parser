import {
    VolumeNode, BookContentNode, ChapterNode, ParagraphNode,
    Span,
    isChapter, isParagraph, isImage,
    isSimpleSpan, isAttributedSpan, isFootnoteSpan, isCompoundSpan,
} from 'booka-common';
import {
    filterUndefined, assertNever, isWhitespaces,
} from '../utils';

export function simplifyVolume(volume: VolumeNode): VolumeNode {
    const nodes = simplifyNodes(volume.nodes);
    return {
        ...volume,
        nodes,
    };
}

function simplifyNodes(nodes: BookContentNode[]): BookContentNode[] {
    return filterUndefined(nodes.map(simplifyNode));
}

function simplifyNode(node: BookContentNode): BookContentNode | undefined {
    if (isChapter(node)) {
        return simplifyChapter(node);
    } else if (isParagraph(node)) {
        return simplifyParagraph(node);
    } else if (isImage(node)) {
        return node;
    } else {
        assertNever(node);
        return node;
    }
}

function simplifyChapter(chapter: ChapterNode): BookContentNode | undefined {
    const nodes = simplifyNodes(chapter.nodes);
    return nodes.length === 0
        ? undefined
        : {
            ...chapter,
            nodes,
        };
}

function simplifyParagraph(paragraph: ParagraphNode): BookContentNode | undefined {
    const span = simplifySpan(paragraph.span);
    return span === undefined
        ? undefined
        : {
            ...paragraph,
            span,
        };
}

function simplifySpan(span: Span): Span | undefined {
    if (isSimpleSpan(span)) {
        return isWhitespaces(span)
            ? undefined
            : span;
    } else if (isAttributedSpan(span)) {
        const content = simplifySpan(span.content);
        return content === undefined
            ? undefined
            : {
                ...span,
                content,
            };
    } else if (isFootnoteSpan(span)) {
        return span;
    } else if (isCompoundSpan(span)) {
        const spans = filterUndefined(span.spans.map(simplifySpan));
        return spans.length === 0
            ? undefined
            : {
                ...span,
                spans,
            };
    } else {
        return assertNever(span);
    }
}
