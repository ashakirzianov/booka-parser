import { PreResolver, IntermPreprocessor, expectAttrs, diagnose, stepsProcessor } from './common';
import { ValueMatcher } from '../utils';

const classes: ValueMatcher<string> = [
    undefined,
    c => c && c.match(/i\d*$/) ? true : false,
    c => c && c.match(/c\d*$/) ? true : false,
    c => c && c.match(/z\d*$/) ? true : false,
    'pgmonospaced', 'center', 'pgheader', 'fig', 'figleft',
    'indexpageno', 'imageref', 'image', 'chapterhead',
    'right', 'chaptername', 'illus', 'floatright',
    // TODO: do not ignore ?
    'letterdate', 'letter1', 'titlepage', 'footer', 'intro',
    'poem', 'poem1', 'gapspace', 'gapshortline', 'noindent',
    'figcenter', 'stanza', 'foot', 'letter', 'gutindent', 'poetry',
    'finis', 'verse', 'gutsumm', 'pfirst', 'right', 'state', 'book',
    'contents', 'preface1', 'preface2',
    'extracts', 'mynote', 'letterdate', 'letter1', 'titlepage',
    'contents', 'centered', 'poem', 'figcenter', 'blockquot',
    'stanza', 'book', 'title', 'title2',
    // TODO: handle properly !!!
    'footnote', 'toc',
];

const steps = stepsProcessor([
    diagnose(node => {
        return expectAttrs(node, {
            class: classes,
        });
    }),
]);

const gutenbergPrep: IntermPreprocessor = steps;
export const gutenberg: PreResolver = ({ rawMetadata }) => {
    if (!rawMetadata) {
        return undefined;
    }

    const gutenbergUrl = 'http://www.gutenberg.org';
    const source = rawMetadata['dc:source'];
    const isGutenbergSource = typeof source === 'string'
        && source.startsWith(gutenbergUrl);
    if (isGutenbergSource) {
        return gutenbergPrep;
    }
    const id = rawMetadata['dc:identifier'];
    const marker = id && id['#'];
    const isMarked = typeof marker === 'string'
        && marker.startsWith(gutenbergUrl);

    return isMarked
        ? gutenbergPrep
        : undefined;
};
