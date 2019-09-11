import { KnownTag } from 'booka-common';
import { MetadataRecordParser, EpubBookParser } from './epubBookParser';
import {
    headParser, yieldOne, makeStream, choice, flattenResult,
    fullParser,
    yieldLast,
} from '../combinators';

export const metadataParser: EpubBookParser<KnownTag[]> = async input => {
    const hooks = input.options[input.epub.kind].metadataHooks;
    const allParsers = hooks.concat(defaultMetadataParser);
    const singleParser = choice(...allParsers);
    const full = flattenResult(fullParser(singleParser));
    const records = Object
        .entries(input.epub.metadata);
    const metaStream = makeStream(records);
    const result = full(metaStream);
    return result.success
        ? yieldOne(result.value, input, result.diagnostic)
        : result;
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
            return fail();
    }
});
