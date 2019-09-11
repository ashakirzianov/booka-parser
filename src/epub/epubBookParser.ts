import { Book, KnownTag, RawBookNode } from 'booka-common';
import { equalsToOneOf } from '../utils';
import {
    makeStream, yieldLast, StreamParser, andAsync, AsyncFullParser,
    translateAsync, pipeAsync,
} from '../combinators';
import { rawNodesParser } from '../rawNodesParser';
import { EpubBook, EpubKind } from './epubBook';
import { sectionsParser } from './sectionParser';
import { metadataParser } from './metaParser';
import { TreeParser } from '../xmlParser';

export type EpubConverterHooks = {
    nodeHooks: EpubNodeParser[],
    metadataHooks: MetadataRecordParser[],
};
export type EpubBookParserInput = {
    epub: EpubBook,
    options: {
        [key in EpubKind]: EpubConverterHooks;
    },
};
export type EpubBookParser<R = Book> = AsyncFullParser<EpubBookParserInput, R>;

export type EpubNodeParserEnv = {
    recursive: TreeParser<RawBookNode[], EpubNodeParserEnv>,
    filePath: string,
};
export type EpubNodeParser<T = RawBookNode[]> = TreeParser<T, EpubNodeParserEnv>;
export type MetadataRecordParser = StreamParser<[string, any], KnownTag[]>;

const diagnoseKind: EpubBookParser<EpubBook> = async input =>
    input.epub.kind === 'unknown'
        ? yieldLast(input.epub, { custom: 'unknown-kind' })
        : yieldLast(input.epub);

export const epubBookParser: EpubBookParser = pipeAsync(
    andAsync(diagnoseKind, metadataParser, sectionsParser),
    async ([epub, tags, rawNodes]) => {
        const metaNodes = buildMetaNodesFromTags(tags);
        const allNodes = rawNodes.concat(metaNodes);

        const volumeResult = await rawNodesParser(makeStream(allNodes, {
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

function buildMetaNodesFromTags(tags: KnownTag[]): RawBookNode[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const nodes = filtered.map(t => ({
        node: 'tag',
        tag: t,
    } as const));
    return nodes;
}
