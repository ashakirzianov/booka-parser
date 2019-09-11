import { KnownTag } from 'booka-common';
import { MetadataRecordParser, EpubBookParser } from './epubBookParser';
import {
    headParser, success, makeStream, choice, flattenResult,
    fullParser,
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
        ? success(result.value, input, result.diagnostic)
        : result;
};

const defaultMetadataParser: MetadataRecordParser = headParser(([key, value]) => {
    switch (key) {
        case 'title':
            return success([{ tag: 'title', value }]);
        case 'creator':
            return success([{ tag: 'author', value }]);
        case 'cover':
            return success([{ tag: 'cover-ref', value }]);
        case 'subject':
            return success([{ tag: 'subject', value }]);
        case 'language':
            return success([{ tag: 'language', value }]);
        case 'publisher':
            return success([{ tag: 'publisher', value }]);
        case 'description':
            return success([{ tag: 'description', value }]);
        case 'series':
            return success([{ tag: 'series', value }]);
        case 'ISBN':
            return success([{ tag: 'ISBN', value }]);
        case 'dc:rights':
            return success([{ tag: 'rights', value }]);
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return success([] as KnownTag[]);
        default:
            return fail();
    }
});
