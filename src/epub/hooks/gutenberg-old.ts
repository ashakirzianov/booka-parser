import { HooksProvider, Hooks } from './hooks';
import { AttributesHookResult } from '../../xml2nodes';
import { MetadataRecordHook } from '../metaParser';
import { success, failure } from '../../combinators';
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
            // Ignore standard: p1, i11, c7, z1, t3b, ind4...
            if (value.match(/([A-Za-z]|ind)\d*b?$/)) { return {}; }
            // Ignore numbers
            if (value.match(/\d+$/)) { return {}; }
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
                case 'QOUTE':
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
                // TODO: handle ?
                case 'letterdate':
                case 'preface1': case 'preface2':
                case 'center': // as formating ?
                case 'gapshortline': // as separator ?
                case 'gutindent': case 'gutsumm': // as list items ?
                case 'bold': // as bold span ?
                case 'halftitle': case 'docTitle':
                case 'book-subtitle': case 'topic-title':
                case 'document-title': case 'section-title':
                case 'maintitle': case 'chaptertitle': // as title node ?
                case 'epigrph':
                case 'monospaced':
                case 'note':
                case 'dialog':
                case 'drama':
                case 'language-en': case 'language-de':
                case 'green':
                case 'caption': case 'faux':
                case 'signature': case 'author':
                case 'little': case 'large':
                case 'small': case 'sml': case 'nindsml':
                case 'noindent':
                case 'scene':
                case 'major': case 'minor':
                case 'line': case 'line-block':
                case 'simple':
                case 'transition': case 'backmatter':
                case 'open': case 'closing':
                case 'cig': case 'modern': case 'hang':
                case 'pg-footer': case 'literal-block':
                case 'start-of-book':
                case 'morality':
                case 'life':
                case 'salutation':
                case 'play':
                case 'order_work':
                case 'hanging':
                case 'example': case 'example-rendered': case 'example-source':
                case 'side':
                case 'block':
                case 'fn':
                case 'glossary':
                case 'indented':
                case 'option':
                case 'with-subtitle': case 'subtitle': case 'section-subtitle':
                case 'legend':
                case 'local':
                case 'attribution':
                case 'stage':
                case 'intro-source':
                case 'broadside':
                case 'index':
                case 'sign':
                case 'byline':
                case 'label':
                case 'myth':
                // Ignore
                case 'initro':
                case 'pub': case 'ded': case 'no': case 'cen':
                case 'no-space-bottom':
                case 'logo':
                case 'small1':
                case 'normal': case 'medium':
                case 'lg':
                case 'image':
                case 'divFigure':
                case 'div': case 'div0': case 'div1': case 'div2':
                case 'body':
                case 'auto-scaled':
                case 'middle':
                case 'loa': case 'lof':
                case 'paragraph':
                case 'tei-l':
                case 'noin': case 'in':
                case 'img': case 'imgl':
                case 'table': case 'hrules-table': case 'tablehead':
                case 'vfill':
                case 'pg':
                case 'secondtd': case 'arial':
                case 'padding5': case 'padding10': case 'padding20':
                case 'xl': case 'ed':
                case 'docutils': case 'margin': case 'margn':
                case 'clearpage': case 'cleardoublepage':
                case 'level-1': case 'level-2': case 'level-3': case 'level-4':
                case 'vspace':
                case 'section': case 'container':
                case 'gapline': case 'gapmediumline':
                case 'gapdoubleline': case 'gapspace':
                case 'ctr':
                case 'smcap':
                case 'neat-left-margin':
                case 'double-space-top': case 'quad-space-bottom': case 'no-space-top':
                case 'left-margin4em':
                case 'state':
                case 'chapterhead':
                case 'pgheader':
                case 'withroman':
                case 'centeredImage':
                case 'figureHead':
                case 'figure': case 'figure-caption':
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
                // default:
                //     // TODO: report all unexpected
                //     return {};
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
                // TODO: find all special
                default:
                    return {};
                // default:
                //     return {
                //         diag: {
                //             diag: 'unexpected pg summary',
                //             summary: value,
                //         },
                //     };
            }
            break;
        default:
            return {};
    }
}
