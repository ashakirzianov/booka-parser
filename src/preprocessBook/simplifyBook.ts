import {
    VolumeNode, ContentNode, ChapterNode, ParagraphNode,
    Span,
} from '../common/bookFormat';
import {
    filterUndefined, assertNever, isWhitespaces,
    isChapter, isParagraph, isSimple, isAttributed,
    isFootnote, isCompound,
} from '../utils';

export function simplifyVolume(volume: VolumeNode): VolumeNode {
    const nodes = simplifyNodes(volume.nodes);
    return {
        ...volume,
        nodes,
    };
}

function simplifyNodes(nodes: ContentNode[]): ContentNode[] {
    return filterUndefined(nodes.map(simplifyNode));
}

function simplifyNode(node: ContentNode): ContentNode | undefined {
    if (isChapter(node)) {
        return simplifyChapter(node);
    } else if (isParagraph(node)) {
        return simplifyParagraph(node);
    } else {
        return assertNever(node);
    }
}

function simplifyChapter(chapter: ChapterNode): ContentNode | undefined {
    const nodes = simplifyNodes(chapter.nodes);
    return nodes.length === 0
        ? undefined
        : {
            ...chapter,
            nodes,
        };
}

function simplifyParagraph(paragraph: ParagraphNode): ContentNode | undefined {
    const span = simplifySpan(paragraph.span);
    return span === undefined
        ? undefined
        : {
            ...paragraph,
            span,
        };
}

function simplifySpan(span: Span): Span | undefined {
    if (isSimple(span)) {
        return isWhitespaces(span)
            ? undefined
            : span;
    } else if (isAttributed(span)) {
        const content = simplifySpan(span.content);
        return content === undefined
            ? undefined
            : {
                ...span,
                content,
            };
    } else if (isFootnote(span)) {
        return span;
    } else if (isCompound(span)) {
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
