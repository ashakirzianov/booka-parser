import { Book, KnownTag, BookContentNode, VolumeMeta } from 'booka-common';
import {
    yieldLast, StreamParser, ParserDiagnostic, ResultLast, compoundDiagnostic, SuccessLast,
} from '../combinators';
import { epubFileParser, EpubBook } from './epubFileParser';
import { metadataParser } from './metaParser';
import { epub2nodes } from './sectionParser';
import { processImages } from './processImages';
import { checkReferences } from './refProcessor';
import { diagnoseText } from './diagnoseText';
import { normalize } from './normalizeBook';

export type EpubParserInput = {
    filePath: string,
};
export type EpubParserOutput = {
    book: Book,
};
export async function parseEpub({ filePath }: EpubParserInput): Promise<ResultLast<EpubParserOutput>> {
    const diags: ParserDiagnostic[] = [];
    const epubResult = await epubFileParser({ filePath });
    if (!epubResult.success) {
        return epubResult;
    }
    const epub = epubResult.value;
    const nodesResult = await epub2nodes(epub);
    diags.push(nodesResult.diagnostic);
    if (!nodesResult.success) {
        return nodesResult;
    }
    const nodes = nodesResult.value;
    const meta = await metadataParser(epub);
    diags.push(meta.diagnostic);
    const tags = meta.success
        ? meta.value
        : [];
    const book = buildBook(nodes, tags);
    const processed = await preprocessBook(book, epub);
    diags.push(processed.diagnostic);
    const result = {
        book: processed.value,
    };
    return yieldLast(result, compoundDiagnostic(diags));
}

async function preprocessBook(book: Book, epub: EpubBook): Promise<SuccessLast<Book>> {
    const diags: ParserDiagnostic[] = [];
    const images = await processImages(epub, book);
    diags.push(images.diagnostic);
    const references = checkReferences(images.value);
    diags.push(references.diagnostic);

    diags.push(await diagnoseText(epub, references.value));

    const normalized = normalize(references.value);
    diags.push(normalized.diagnostic);

    return yieldLast(normalized.value, compoundDiagnostic(diags));
}

export type MetadataRecordParser = StreamParser<[string, any], KnownTag[]>;

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
