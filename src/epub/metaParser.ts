import { KnownTag } from 'booka-common';
import { MetadataRecordParser, EpubBookParser } from './epubBookParser';
import {
    headParser, yieldOne, makeStream, choice, flattenResult,
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
        ? yieldOne(result.value, input, result.diagnostic)
        : result;
};

const defaultMetadataParser: MetadataRecordParser = headParser(([key, value]) => {
    switch (key) {
        case 'title':
            return yieldOne([{ tag: 'title', value }]);
        case 'creator':
            return yieldOne([{ tag: 'author', value }]);
        case 'cover':
            return yieldOne([{ tag: 'cover-ref', value }]);
        case 'subject':
            return yieldOne([{ tag: 'subject', value }]);
        case 'language':
            return yieldOne([{ tag: 'language', value }]);
        case 'publisher':
            return yieldOne([{ tag: 'publisher', value }]);
        case 'description':
            return yieldOne([{ tag: 'description', value }]);
        case 'series':
            return yieldOne([{ tag: 'series', value }]);
        case 'ISBN':
            return yieldOne([{ tag: 'ISBN', value }]);
        case 'dc:rights':
            return yieldOne([{ tag: 'rights', value }]);
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return yieldOne([] as KnownTag[]);
        default:
            return fail();
    }
});
