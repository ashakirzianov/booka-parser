import { KnownTag, buildTagSet, flatten } from 'booka-common';
import {
    headParser, yieldLast, makeStream, choice,
    AsyncFullParser, some, reportUnparsedTail, reject, translate,
} from '../combinators';
import { EpubBook } from './epubFileParser';
import { MetadataRecordParser } from './epubBookParser';

export const metadataParser: AsyncFullParser<EpubBook, KnownTag[]> = async epub => {
    const hooks = [] as MetadataRecordParser[]; // epubParserHooks[epub.kind].metadataHooks;
    const allParsers = hooks.concat(defaultMetadataParser);
    const singleParser = choice(...allParsers);
    const full = translate(
        reportUnparsedTail(some(singleParser), tail => ({
            diag: 'unexpected-metas',
            metas: tail.stream,
        })),
        flatten,
    );
    const records = Object
        .entries(epub.metadata);
    const metaStream = makeStream(records);
    const result = full(metaStream);
    if (result.success) {
        const unique = buildTagSet(result.value);
        return yieldLast(unique, result.diagnostic);
    } else {
        return result;
    }
};

const defaultMetadataParser: MetadataRecordParser = headParser(([key, value]) => {
    switch (key) {
        case 'title':
            return yieldLast([{ tag: 'title', value }]);
        case 'creator':
            return yieldLast([{ tag: 'author', value }]);
        case 'cover':
            return yieldLast([{ tag: 'cover-ref', value }]);
        case 'subject':
            return yieldLast([{ tag: 'subject', value }]);
        case 'language':
            return yieldLast([{ tag: 'language', value }]);
        case 'publisher':
            return yieldLast([{ tag: 'publisher', value }]);
        case 'description':
            return yieldLast([{ tag: 'description', value }]);
        case 'series':
            return yieldLast([{ tag: 'series', value }]);
        case 'ISBN':
            return yieldLast([{ tag: 'ISBN', value }]);
        case 'dc:rights':
            return yieldLast([{ tag: 'rights', value }]);
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return yieldLast([] as KnownTag[]);
        default:
            // TODO: reject
            // return reject();
            return yieldLast([] as KnownTag[]);
    }
});
