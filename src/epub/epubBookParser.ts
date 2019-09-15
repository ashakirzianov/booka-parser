import { Book, KnownTag, processImagesAsync } from 'booka-common';
import { equalsToOneOf } from '../utils';
import {
    makeStream, yieldLast, StreamParser, andAsync, AsyncFullParser, pipeAsync, ParserDiagnostic, compoundDiagnostic,
} from '../combinators';
import { elements2volume, BookElement } from '../bookElementParser';
import { EpubBook, EpubKind } from './epubBook';
import { sectionsParser } from './sectionParser';
import { metadataParser } from './metaParser';
import { Tree2ElementsParser } from '../xmlTreeParser';

export type EpubBookParserHooks = {
    nodeHooks: Tree2ElementsParser[],
    metadataHooks: MetadataRecordParser[],
};
export type EpubBookParserInput = {
    epub: EpubBook,
    options: {
        [key in EpubKind]: EpubBookParserHooks;
    },
};
export type EpubBookParser<R = Book> = AsyncFullParser<EpubBookParserInput, R>;
export type MetadataRecordParser = StreamParser<[string, any], KnownTag[]>;

const diagnoseKind: EpubBookParser<EpubBook> = async input =>
    input.epub.kind === 'unknown'
        ? yieldLast(input.epub, { diag: 'unknown-kind' })
        : yieldLast(input.epub);

export const epubBookParser: EpubBookParser = pipeAsync(
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
        const resolved = await processImagesAsync(book.volume, async imageNode => {
            if (imageNode.node === 'image-ref') {
                const buffer = await epub.imageResolver(imageNode.imageRef);
                if (buffer) {
                    return {
                        node: 'image-data',
                        imageId: imageNode.imageId,
                        data: buffer,
                    };
                } else {
                    diags.push({ diag: 'couldnt-resolve-image', id: imageNode.imageId });
                    return imageNode;
                }
            } else {
                return imageNode;
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
