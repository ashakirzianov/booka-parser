import { Book, KnownTag, BookNode, BookMeta } from 'booka-common';
import {
    yieldLast, StreamParser, ParserDiagnostic, ResultLast, compoundDiagnostic,
} from '../combinators';
import { epubFileParser } from './epubFileParser';
import { metadataParser } from './metaParser';
import { epub2nodes } from './sectionParser';
import { preprocess } from './preprocessor';
import { resolveHooks } from './hooks';

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

    const hooks = resolveHooks(epub);
    if (hooks === undefined) {
        diags.push({
            diag: 'unknown book kind',
            meta: epub.rawMetadata,
        });
    }
    const nodesResult = await epub2nodes(epub, hooks && hooks.xml);
    diags.push(nodesResult.diagnostic);
    if (!nodesResult.success) {
        return nodesResult;
    }
    const nodes = nodesResult.value;
    const meta = metadataParser(epub, undefined);
    diags.push(meta.diagnostic);
    const tags = meta.success
        ? meta.value
        : [];
    const book = buildBook(nodes, tags);
    const processed = await preprocess({ book, epub });
    diags.push(processed.diagnostic);
    const result = {
        book: processed.value,
    };
    return yieldLast(result, compoundDiagnostic(diags));
}

function buildBook(nodes: BookNode[], tags: KnownTag[]): Book {
    const meta = buildMeta(tags);
    return {
        meta,
        nodes,
        tags,
    };
}

function buildMeta(tags: KnownTag[]) {
    const meta: BookMeta = {};
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
