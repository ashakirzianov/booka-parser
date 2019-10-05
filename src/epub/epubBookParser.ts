import { Book, KnownTag, processNodeImagesAsync } from 'booka-common';
import { equalsToOneOf } from '../utils';
import {
    makeStream, yieldLast, andAsync, AsyncFullParser, pipeAsync, ParserDiagnostic, compoundDiagnostic, StreamParser,
} from '../combinators';
import { elements2book, BookElement } from '../bookElementParser';
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

        const bookResult = await elements2book(makeStream(allNodes));

        if (!bookResult.success) {
            return bookResult;
        }

        const book: Book = bookResult.value;

        return yieldLast({ book, epub }, bookResult.diagnostic);
    },
    // Resolve image references
    async ({ book, epub }) => {
        const diags: ParserDiagnostic[] = [];
        const resolved = await processNodeImagesAsync(book.volume, async image => {
            if (image.kind === 'ref') {
                const buffer = await epub.imageResolver(image.ref);
                if (buffer) {
                    return {
                        ...image,
                        kind: 'buffer',
                        imageId: image.imageId,
                        buffer: buffer,
                    };
                } else {
                    diags.push({
                        diag: 'couldnt-resolve-image',
                        id: image.imageId,
                    });
                    return image;
                }
            } else {
                return image;
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
