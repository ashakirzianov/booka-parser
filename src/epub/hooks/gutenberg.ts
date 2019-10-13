import { HooksProvider } from './hooks';
import { XmlHooks, AttributesHookResult } from '../../xml2nodes';

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

const gutenbergHooks: XmlHooks = {
    attributesHook,
};

function attributesHook(element: string, attr: string, value: string): AttributesHookResult {
    switch (attr) {
        case 'class':
            // Ignore standard: i11, c7, z1...
            if (value.match(/[icz]\d*$/)) { return {}; }
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
                // TODO: handle ?
                case 'letterdate':
                case 'preface1': case 'preface2':
                case 'center': // as formating ?
                case 'gapshortline': // as separator ?
                case 'gutindent': case 'gutsumm': // as list items ?
                case 'noindent':
                case 'footnote':
                case 'scene':
                case 'ctr': case 'ind':
                // Ignore
                case 'state':
                case 'gapspace': case 'chapterhead':
                case 'pgmonospaced': case 'pgheader':
                case 'fig': case 'figleft': case 'figcenter':
                case 'foot': case 'finis':
                case 'right': case 'pfirst':
                case 'contents': case 'book':
                case 'title': case 'title2':
                case 'centered':
                case 'chapter': case 'foots':
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
