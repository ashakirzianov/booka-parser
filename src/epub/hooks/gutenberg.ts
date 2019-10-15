import { HooksProvider, Hooks } from './hooks';
import { AttributesHookResult } from '../../xml2nodes';
import { MetadataRecordHook } from '../metaParser';
import { yieldLast, reject } from '../../combinators';
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
            return yieldLast(tags);
        case 'dc:rights':
            switch (value) {
                case 'Copyrighted. Read the copyright notice inside this book for details.':
                    return yieldLast([{
                        tag: 'license',
                        value: 'pg-copyrighted',
                    }]);
                case 'Public domain':
                    return yieldLast([{
                        tag: 'license',
                        value: 'public-domain',
                    }]);
                case 'Public domain in the USA.':
                    return yieldLast([{
                        tag: 'license',
                        value: 'public-domain-us',
                    }]);
                // PG Special cases
                case 'La Divina Commedia di Dante':
                    return yieldLast([{
                        tag: 'license',
                        value: 'public-domain',
                    }]);
                // Report
                default:
                    return yieldLast([{
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
                        return yieldLast([{ tag: 'pg-index', value: index }]);
                    }
                }
            }

            return yieldLast([], { diag: 'bad-meta', meta: { key, value } });
        default:
            return reject();
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
                        semantics: [{
                            semantic: 'tech-note',
                            source: 'project-gutenberg',
                        }],
                    };
                case 'QUOTE':
                case 'blockquote':
                case 'blockquot':
                case 'pullquote':
                case 'quotation':
                case 'quote':
                    return {
                        semantics: [{
                            semantic: 'quote',
                        }],
                    };
                case 'extracts':
                    return { flag: 'extracts' };
                case 'titlepage':
                    return { flag: 'title-page' };
                case 'illus':
                    return { flag: 'illustrations' };
                case 'pgmonospaced':
                    return { flag: 'formated' };
                case 'foot': case 'footnote':
                    return {
                        semantics: [{
                            semantic: 'footnote',
                        }],
                    };
                case 'foots':
                    return {
                        semantics: [{
                            semantic: 'footnote-group',
                        }],
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
