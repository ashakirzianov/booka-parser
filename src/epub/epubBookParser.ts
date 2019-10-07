import { Book, KnownTag, processNodeImagesAsync, BookContentNode, VolumeMeta } from 'booka-common';
import {
    yieldLast, andAsync, AsyncFullParser, pipeAsync, ParserDiagnostic, compoundDiagnostic, StreamParser,
} from '../combinators';
import { EpubBook } from './epubFileParser';
import { metadataParser } from './metaParser';
import { Tree2ElementsParser } from '../xmlTreeParser';
import { epub2nodes } from './sectionParser';

export type MetadataRecordParser = StreamParser<[string, any], KnownTag[]>;
export type EpubBookParserHooks = {
    nodeHooks: Tree2ElementsParser[],
    metadataHooks: MetadataRecordParser[],
};

const ident: AsyncFullParser<EpubBook, EpubBook> = async epub =>
    yieldLast(epub);

export const epubBookParser: AsyncFullParser<EpubBook, Book> = pipeAsync(
    // Diagnose book kind, parse metadata and sections
    andAsync(ident, metadataParser, epub2nodes),
    // Parse book elements
    async ([epub, tags, nodes]) => {
        const book: Book = buildBook(nodes, tags);

        return yieldLast({ book, epub });
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

function buildBook(nodes: BookContentNode[], tags: KnownTag[]): Book {
    const meta = buildMeta(tags);
    return {
        volume: {
            node: 'volume',
            nodes,
            meta,
        },
        tags,
    };
}

function buildMeta(tags: KnownTag[]) {
    const meta: VolumeMeta = {};
    for (const tag of tags) {
        switch (tag.tag) {
            case 'title':
                meta.title = tag.value;
                continue;
            case 'author':
                meta.author = tag.value;
                continue;
            case 'cover-ref':
                meta.coverImage = {
                    kind: 'ref',
                    title: 'cover',
                    ref: tag.value,
                    imageId: tag.value,
                };
                continue;
        }
    }

    return meta;
}
