import { success, failure } from 'booka-common';
import { HooksProvider, Hooks } from './hooks';
import { AttributesHookResult } from '../../xml2nodes';
import { MetadataRecordHook } from '../metaParser';
import { flatten, KnownTag } from 'booka-common';

export const gutenberg: HooksProvider = ({ rawMetadata }) => {
    if (!rawMetadata) {
        return undefined;
    }

    const gutenbergUrl = 'http://www.gutenberg.org';
    const source = rawMetadata['dc:source'];
    const isGutenbergSource = typeof source === 'string'
        && source.startsWith(gutenbergUrl);
    if (isGutenbergSource) {
        return gutenbergHooks;
    }
    const id = rawMetadata['dc:identifier'];
    const marker = id && id['#'];
    const isMarked = typeof marker === 'string'
        && marker.startsWith(gutenbergUrl);

    return isMarked
        ? gutenbergHooks
        : undefined;
};

const metadata: MetadataRecordHook = (key, value) => {
    switch (key) {
        case 'subject':
            const subs = value as string[];
            const subjects = flatten(subs.map(sub => sub.split(' -- ')));
            const tags: KnownTag[] = subjects.map(sub => ({
                tag: 'subject' as const,
                value: sub,
            }));
            return success(tags);
        case 'dc:rights':
            switch (value) {
                case 'Copyrighted. Read the copyright notice inside this book for details.':
                case 'Copyrighted. See text for details.':
                    return success([{
                        tag: 'license',
                        value: 'pg-copyrighted',
                    }]);
                case 'Public domain':
                    return success([{
                        tag: 'license',
                        value: 'public-domain',
                    }]);
                case 'Public domain in the USA.':
                    return success([{
                        tag: 'license',
                        value: 'public-domain-us',
                    }]);
                // PG Special cases
                case 'La Divina Commedia di Dante':
                    return success([{
                        tag: 'license',
                        value: 'public-domain',
                    }]);
                // Report
                default:
                    return success([{
                        tag: 'rights',
                        value,
                    }], {
                        diag: 'unexpected pg rights meta',
                        severity: 'warning',
                        rights: value,
                    });
            }
            break;
        case 'dc:identifier':
            const id = value['#'];
            if (id && typeof id === 'string') {
                const matches = id.match(/http:\/\/www.gutenberg\.org\/(ebooks\/)?([0-9]*)/);
                if (matches && matches[2]) {
                    const index = parseInt(matches[2], 10);
                    if (index) {
                        return success([{ tag: 'pg-index', value: index }]);
                    }
                }
            }

            return success([], { diag: 'bad-meta', meta: { key, value } });
        default:
            return failure();
    }
};

const gutenbergHooks: Hooks = {
    xml: { attributesHook },
    metadata,
};

function attributesHook(element: string, attr: string, value: string): AttributesHookResult {
    switch (attr) {
        case 'class':
            switch (value) {
                case 'charname':
                    return { flag: 'character-name' };
                case 'rsidenote': case 'lsidenote':
                    return { flag: 'side-note' };
                case 'intro':
                    return { flag: 'chapter-abstract' };
                case 'footer':
                    return { flag: 'footer' };
                case 'poetry-container':
                case 'poem': case 'poem1':
                case 'poem2': case 'poem3':
                case 'verse': case 'poetry':
                case 'stanza':
                    return { flag: 'poem' };
                case 'letter_greeting':
                case 'letter': case 'letter1': case 'letter2':
                    return { flag: 'letter' };
                case 'mynote':
                    return {
                        flag: 'tech-note',
                    };
                case 'QUOTE':
                case 'blockquote':
                case 'blockquot':
                case 'pullquote':
                case 'quotation':
                case 'quote':
                    return {
                        flag: 'quote',
                    };
                case 'extracts':
                    return { flag: 'extracts' };
                case 'titlepage':
                    return { flag: 'title-page' };
                case 'illus':
                    return { flag: 'illustrations' };
                case 'pgmonospaced':
                    return { flag: 'formated' };
                case 'foots': case 'foot': case 'footnote':
                    return {
                        flag: 'footnote',
                    };
                case 'toc':
                    return { flag: 'table-of-contents' };
                case 'boilerplate':
                case 'tnote': case 'transnote':
                    return { flag: 'editor-note' };
                case 'buscard':
                    return { flag: 'card' };
            }
            break;
        case 'summary':
            switch (value) {
                case 'carol':
                    return { flag: 'poem' };
                case 'Illustrations':
                    return { flag: 'illustrations' };
                case 'Contents':
                case 'Toc':
                    return { flag: 'table-of-contents' };
            }
            break;
    }
    return {};
}
