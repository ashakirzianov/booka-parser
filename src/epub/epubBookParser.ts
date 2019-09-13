import { Book, KnownTag, Span } from 'booka-common';
import { equalsToOneOf } from '../utils';
import {
    makeStream, yieldLast, StreamParser, andAsync, AsyncFullParser, pipeAsync,
} from '../combinators';
import { elementParser, BookElement } from '../bookElementParser';
import { EpubBook, EpubKind } from './epubBook';
import { sectionsParser } from './sectionParser';
import { metadataParser } from './metaParser';
import { TreeParser } from '../xmlTreeParser';

export type EpubBookParserHooks = {
    nodeHooks: EpubElementParser[],
    metadataHooks: MetadataRecordParser[],
};
export type EpubBookParserInput = {
    epub: EpubBook,
    options: {
        [key in EpubKind]: EpubBookParserHooks;
    },
};
export type EpubBookParser<R = Book> = AsyncFullParser<EpubBookParserInput, R>;

export type EpubTreeParserEnv = {
    span: TreeParser<Span, EpubTreeParserEnv>,
    recursive: TreeParser<BookElement[], EpubTreeParserEnv>,
    filePath: string,
};
export type EpubTreeParser<T> = TreeParser<T, EpubTreeParserEnv>;
export type EpubSpanParser = EpubTreeParser<Span>;
export type EpubElementParser = EpubTreeParser<BookElement[]>;
export type MetadataRecordParser = StreamParser<[string, any], KnownTag[]>;

const diagnoseKind: EpubBookParser<EpubBook> = async input =>
    input.epub.kind === 'unknown'
        ? yieldLast(input.epub, { diag: 'unknown-kind' })
        : yieldLast(input.epub);

export const epubBookParser: EpubBookParser = pipeAsync(
    andAsync(diagnoseKind, metadataParser, sectionsParser),
    async ([epub, tags, elements]) => {
        const metaNodes = buildMetaElementsFromTags(tags);
        const allNodes = elements.concat(metaNodes);

        const volumeResult = await elementParser(makeStream(allNodes, {
            resolveImageRef: epub.imageResolver,
        }));

        if (!volumeResult.success) {
            return volumeResult;
        }

        const volume = volumeResult.value;
        const book: Book = {
            volume,
            source: {
                source: 'epub',
                kind: epub.kind,
            },
            tags: tags,
        };

        return yieldLast(book, volumeResult.diagnostic);
    }
);

function buildMetaElementsFromTags(tags: KnownTag[]): BookElement[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const elements = filtered.map(t => ({
        element: 'tag',
        tag: t,
    } as const));
    return elements;
}
