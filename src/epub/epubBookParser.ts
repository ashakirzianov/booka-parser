import { Book, KnownTag, processNodeAsync } from 'booka-common';
import { equalsToOneOf } from '../utils';
import {
    makeStream, yieldLast, andAsync, AsyncFullParser, pipeAsync, ParserDiagnostic, compoundDiagnostic, StreamParser,
} from '../combinators';
import { elements2volume, BookElement } from '../bookElementParser';
import { EpubBook } from './epubBook';
import { sectionsParser } from './sectionParser';
import { metadataParser } from './metaParser';
import { Tree2ElementsParser } from '../xmlTreeParser';

export type MetadataRecordParser = StreamParser<[string, any], KnownTag[]>;
export type EpubBookParserHooks = {
    nodeHooks: Tree2ElementsParser[],
    metadataHooks: MetadataRecordParser[],
};

const diagnoseKind: AsyncFullParser<EpubBook, EpubBook> = async epub =>
    epub.kind === 'unknown'
        ? yieldLast(epub, { diag: 'unknown-kind' })
        : yieldLast(epub);

export const epubBookParser: AsyncFullParser<EpubBook, Book> = pipeAsync(
    // Diagnose book kind, parse metadata and sections
    andAsync(diagnoseKind, metadataParser, sectionsParser),
    // Parse book elements
    async ([epub, tags, elements]) => {
        const metaNodes = buildMetaElementsFromTags(tags);
        const allNodes = elements.concat(metaNodes);

        const volumeResult = await elements2volume(makeStream(allNodes));

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

        return yieldLast({ book, epub }, volumeResult.diagnostic);
    },
    // Resolve image references
    async ({ book, epub }) => {
        const diags: ParserDiagnostic[] = [];
        const resolved = await processNodeAsync(book.volume, async node => {
            if (node.node === 'image-ref') {
                const buffer = await epub.imageResolver(node.imageRef);
                if (buffer) {
                    return {
                        node: 'image-data',
                        imageId: node.imageId,
                        data: buffer,
                    };
                } else {
                    diags.push({ diag: 'couldnt-resolve-image', id: node.imageId });
                    return node;
                }
            } else {
                return node;
            }
        });
        return yieldLast({ ...book, volume: resolved }, compoundDiagnostic(diags));
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
