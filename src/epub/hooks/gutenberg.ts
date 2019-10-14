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
        case 'dc:identifier':
            const id = value['#'];
            if (id && typeof id === 'string') {
                const matches = id.match(/http:\/\/www.gutenberg\.org\/ebooks\/([0-9]*)/);
                if (matches && matches[1]) {
                    const index = parseInt(matches[1], 10);
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
            // Ignore standard: i11, c7, z1, t3b, ind4...
            if (value.match(/([iczt]|ind)\d*b?$/)) { return {}; }
            switch (value) {
                case 'charname':
                    return { flag: 'character-name' };
                case 'rsidenote': case 'lsidenote':
                    return { flag: 'side-note' };
                case 'intro':
                    return { flag: 'chapter-abstract' };
                case 'footer':
                    return { flag: 'footer' };
                case 'poem': case 'poem1':
                case 'verse': case 'poetry':
                case 'stanza':
                    return { flag: 'poem' };
                case 'letter': case 'letter1': case 'letter2':
                    return { flag: 'letter' };
                case 'mynote':
                    return {
                        semantics: [{
                            semantic: 'tech-note',
                            source: 'project-gutenberg',
                        }],
                    };
                case 'blockquot':
                case 'pullquote':
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
                case 'foot':
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
                    return { flag: 'editor-note' };
                case 'buscard':
                    return { flag: 'card' };
                // TODO: handle ?
                case 'letterdate':
                case 'preface1': case 'preface2':
                case 'center': // as formating ?
                case 'gapshortline': // as separator ?
                case 'gutindent': case 'gutsumm': // as list items ?
                case 'bold': // as bold span ?
                case 'chaptertitle': // as title node ?
                case 'signature': case 'author':
                case 'small':
                case 'noindent':
                case 'footnote':
                case 'scene':
                case 'major': case 'minor':
                // Ignore
                case 'ctr':
                case 'smcap':
                case 'double-space-top': case 'quad-space-bottom': case 'no-space-top':
                case 'left-margin4em':
                case 'state':
                case 'gapspace': case 'chapterhead':
                case 'pgheader':
                case 'fig': case 'figleft': case 'figcenter':
                case 'finis':
                case 'right': case 'pfirst':
                case 'contents': case 'book':
                case 'title': case 'title2':
                case 'centered':
                case 'chapter':
                case 'narrow': case 'med':
                case 'tiny': case 'short': case 'main':
                case 'break': case 'full':
                case 'none': case 'nonetn':
                    return {};
                default:
                    return {
                        diag: {
                            diag: 'unexpected pg class',
                            class: value,
                        },
                    };
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
                case '':
                    return {};
                default:
                    return {
                        diag: {
                            diag: 'unexpected pg summary',
                            summary: value,
                        },
                    };
            }
            break;
        default:
            return {};
    }
}
