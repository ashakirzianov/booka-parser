import { KnownTag } from 'booka-common';
import { MetadataRecordParser, EpubBookParser } from './epubBookParser';
import {
    headParser, successValue, makeStream, choice, flattenResult,
    fullParser, success,
} from '../combinators';

export const metadataParser: EpubBookParser<KnownTag[]> = async input => {
    const hooks = input.options[input.epub.kind].metadataHooks;
    const allParsers = hooks.concat(defaultMetadataParser);
    const singleParser = choice(...allParsers);
    const full = flattenResult(fullParser(singleParser));
    const records = Object
        .entries(input.epub.metadata)
        .map(([key, value]) => ({ key, value }));
    const metaStream = makeStream(records);
    const result = full(metaStream);
    return result.success
        ? success(result.value, input, result.diagnostic)
        : result;
};

const defaultMetadataParser: MetadataRecordParser = headParser(({ key, value }) => {
    switch (key) {
        case 'title':
            return successValue([{ tag: 'title', value }]);
        case 'creator':
            return successValue([{ tag: 'author', value }]);
        case 'cover':
            return successValue([{ tag: 'cover-ref', value }]);
        case 'subject':
            return successValue([{ tag: 'subject', value }]);
        case 'language':
            return successValue([{ tag: 'language', value }]);
        case 'publisher':
            return successValue([{ tag: 'publisher', value }]);
        case 'description':
            return successValue([{ tag: 'description', value }]);
        case 'series':
            return successValue([{ tag: 'series', value }]);
        case 'ISBN':
            return successValue([{ tag: 'ISBN', value }]);
        case 'dc:rights':
            return successValue([{ tag: 'rights', value }]);
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return successValue([] as KnownTag[]);
        default:
            return fail();
    }
});
