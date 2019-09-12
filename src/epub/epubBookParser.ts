import { Book, KnownTag, Span, BookContentNode } from 'booka-common';
import { equalsToOneOf } from '../utils';
import {
    makeStream, yieldLast, StreamParser, andAsync, AsyncFullParser, pipeAsync,
} from '../combinators';
import { elementParser, BookElement } from '../bookElementParser';
import { EpubBook, EpubKind } from './epubBook';
import { sectionsParser } from './sectionParser';
import { metadataParser } from './metaParser';
import { TreeParser } from '../xmlParser';

export type EpubBookParserHooks = {
    nodeHooks: EpubNodeParser[],
    metadataHooks: MetadataRecordParser[],
};
export type EpubBookParserInput = {
    epub: EpubBook,
    options: {
        [key in EpubKind]: EpubBookParserHooks;
    },
};
export type EpubBookParser<R = Book> = AsyncFullParser<EpubBookParserInput, R>;

export type EpubNodeParserEnv = {
    span: TreeParser<Span, EpubNodeParserEnv>,
    paragraph: TreeParser<BookContentNode, EpubNodeParserEnv>,
    recursive: TreeParser<BookElement[], EpubNodeParserEnv>,
    filePath: string,
};
export type EpubNodeParser<T = BookElement[]> = TreeParser<T, EpubNodeParserEnv>;
export type EpubSpanParser = EpubNodeParser<Span>;
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
