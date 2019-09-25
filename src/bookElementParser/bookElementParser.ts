import {
    BookContentNode, ChapterNode, VolumeNode, VolumeMeta,
} from 'booka-common';
import {
    AsyncStreamParser, yieldLast, ParserDiagnostic,
    compoundDiagnostic, reject, StreamParser, headParser, yieldNext, choice, some, makeStream, seq, expectEoi, projectFirst, pipeAsync,
} from '../combinators';
import { BookElement, TitleOrContentElement } from './bookElement';

export const elements2volume: AsyncStreamParser<BookElement, VolumeNode> = pipeAsync(
    async ({ stream }) => {
        return parseMeta(stream);
    },
    async ({ meta, titleOrContent }) => {
        const volumeNodes = allElements(makeStream(titleOrContent, {
            level: undefined,
        }));
        if (!volumeNodes.success) {
            return volumeNodes;
        }

        const volume: VolumeNode = {
            node: 'volume',
            nodes: volumeNodes.value,
            meta: meta,
        };

        return yieldLast(volume, volumeNodes.diagnostic);
    }
);

function parseMeta(elements: BookElement[]) {
    const meta: VolumeMeta = {};
    const titleOrContent: TitleOrContentElement[] = [];
    const diags: ParserDiagnostic[] = [];
    for (const el of elements) {
        switch (el.element) {
            case 'tag':
                const tag = el.tag;
                switch (tag.tag) {
                    case 'title':
                        meta.title = tag.value;
                        break;
                    case 'author':
                        meta.author = tag.value;
                        break;
                    case 'cover-ref':
                        meta.coverImageNode = {
                            node: 'image-ref',
                            imageId: tag.value,
                            imageRef: tag.value,
                        };
                        break;
                }
                break;
            case 'chapter-title':
            case 'content':
                titleOrContent.push(el);
                break;
            default:
                break;
        }
    }

    if (meta.title === undefined) {
        diags.push({ diag: 'empty-book-title' });
    }

    return yieldLast({
        meta, titleOrContent,
    }, compoundDiagnostic(diags));
}

type BookElementsEnv = {
    level: number | undefined,
};
type BookElementParser = StreamParser<TitleOrContentElement, BookContentNode, BookElementsEnv>;

const contentElement: BookElementParser = headParser(head =>
    head.element === 'content'
        ? yieldLast(head.content)
        : reject()
);
const titleElement: BookElementParser = input => {
    const head = input.stream[0];
    if (head && head.element === 'chapter-title') {
        if (input.env.level === undefined || head.level === undefined || input.env.level > head.level) {
            const inside = bookElement(makeStream(input.stream.slice(1), {
                level: head.level,
            }));
            const insideLevel = head.level !== undefined ? head.level
                : input.env.level !== undefined ? input.env.level - 1
                    : 0;
            const chapter: ChapterNode = {
                node: 'chapter',
                level: insideLevel,
                title: head.title,
                nodes: inside.value,
            };
            return yieldNext(chapter, inside.next && makeStream(inside.next.stream, input.env));
        } else {
            return reject();
        }
    } else {
        return reject();
    }
};

const bookElement = some(choice(contentElement, titleElement));

const allElements = projectFirst(
    seq(bookElement, expectEoi('build-chapter'))
);
