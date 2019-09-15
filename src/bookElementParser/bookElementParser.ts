import {
    BookContentNode, ChapterNode, VolumeNode, VolumeMeta,
} from 'booka-common';
import {
    AsyncStreamParser, yieldLast, ParserDiagnostic,
    compoundDiagnostic, reject, StreamParser, headParser, yieldOne, choice, some, makeStream, seq, expectEmpty, projectFirst,
} from '../combinators';
import { BookElement, TitleOrContentElement } from './bookElement';

export type ElementParser = AsyncStreamParser<BookElement, VolumeNode>;

export const elementParser: ElementParser = async ({ stream }) => {
    const diags: ParserDiagnostic[] = [];
    const result = parseMeta(stream);
    diags.push(result.diagnostic);
    const volumeNodes = volumeContent(makeStream(result.value.titleOrContent, {
        level: undefined,
    }));
    diags.push(volumeNodes.diagnostic);
    if (!volumeNodes.success) {
        return reject(compoundDiagnostic(diags));
    }

    const volume: VolumeNode = {
        node: 'volume',
        nodes: volumeNodes.value,
        meta: result.value.meta,
    };

    return yieldLast(volume, compoundDiagnostic(diags));
};

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

type BuildChaptersEnv = {
    level: number | undefined,
};
type BuildChaptersParser = StreamParser<TitleOrContentElement, BookContentNode, BuildChaptersEnv>;

const contentNode: BuildChaptersParser = headParser(head =>
    head.element === 'content'
        ? yieldLast(head.content)
        : reject()
);
const titleNode: BuildChaptersParser = input => {
    const head = input.stream[0];
    if (head && head.element === 'chapter-title') {
        if (input.env.level === undefined || input.env.level > head.level) {
            const inside = content(makeStream(input.stream.slice(1), {
                level: head.level,
            }));
            const chapter: ChapterNode = {
                node: 'chapter',
                level: head.level,
                title: head.title,
                nodes: inside.value,
            };
            return yieldOne(chapter, inside.next && makeStream(inside.next.stream, input.env));
        } else {
            return reject();
        }
    } else {
        return reject();
    }
};

const content = some(choice(contentNode, titleNode));

const volumeContent = projectFirst(
    seq(
        content,
        expectEmpty,
    )
);
