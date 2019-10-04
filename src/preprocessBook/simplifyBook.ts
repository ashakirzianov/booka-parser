import {
    VolumeNode, BookContentNode, ChapterNode, ParagraphNode,
    Span, Book, assertNever, filterUndefined, pphSpan,
} from 'booka-common';
import { isWhitespaces } from '../utils';

export function simplifyBook(book: Book): Book {
    const volume = simplifyVolume(book.volume);
    return {
        ...book,
        volume,
    };
}

function simplifyVolume(volume: VolumeNode): VolumeNode {
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
    switch (node.node) {
        case 'chapter':
            return simplifyChapter(node);
        case undefined:
        case 'pph':
            return simplifyParagraph(node);
        case 'group':
        case 'table':
        case 'list':
            return node;
        case 'image-data':
        case 'image-ref':
        case 'separator':
            return node;
        default:
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
    if (paragraph.node === undefined) {
        return simplifySpan(paragraph);
    } else {
        const span = simplifySpan(paragraph.span);
        return span === undefined
            ? undefined
            : { ...paragraph, span: span };
    }
}

function simplifySpan(span: Span): Span | undefined {
    switch (span.span) {
        case undefined:
            return span;
        case 'attrs':
        case 'ref':
            const content = simplifySpan(span.content);
            return content === undefined
                ? undefined
                : {
                    ...span,
                    content,
                };
        case 'compound':
            const spans = filterUndefined(span.spans.map(simplifySpan));
            return spans.length === 0
                ? undefined
                : {
                    ...span,
                    spans,
                };
        default:
            assertNever(span);
            return span;
    }
}
