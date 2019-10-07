import { PreResolver, IntermPreprocessor, expectAttrs, diagnose, stepsProcessor, assignSemantic, flagClass, processSpan, hasClass } from './common';
import { ValueMatcher, ObjectMatcher, CompoundMatcher } from '../utils';
import { IntermAttrs, IntermNodeKey } from './intermediateNode';

const steps = stepsProcessor([
    processSpan(s =>
        hasClass(s, 'GutSmall')
            ? {
                interm: 'small',
                attrs: {},
                content: [s],
            }
            : undefined
    ),
    flagClass('mynote', 'editor-note'),
    flagClass('extracts', 'extracts'),
    assignSemantic(node =>
        node.attrs['xml:space'] === 'preserve'
            ? { semantic: 'formated' }
            : undefined,
    ),
    diagnose(node => {
        const ext = expectedAttrsMap[node.interm] || {};
        const expected = {
            ...standardAttrs,
            ...ext,
            class: ext.class
                ? [...standardClass, ...ext.class]
                : standardClass,
        };
        return expectAttrs(node, expected);
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

const standardClass: CompoundMatcher<string> = [
    undefined,
    c => c && c.match(/i\d*$/) ? true : false,
    c => c && c.match(/c\d*$/) ? true : false,
    c => c && c.match(/z\d*$/) ? true : false,
    'smcap', 'indexpageno',
    // 'pgmonospaced', 'center', 'pgheader', 'fig', 'figleft',
    // 'indexpageno', 'imageref', 'image', 'chapterhead',
    // 'right', 'chaptername', 'illus', 'floatright',
    // // TODO: do not ignore ?
    // 'letterdate', 'letter1', 'titlepage', 'footer', 'intro',
    // 'poem', 'poem1', 'gapspace', 'gapshortline', 'noindent',
    // 'figcenter', 'stanza', 'foot', 'letter', 'gutindent', 'poetry',
    // 'finis', 'verse', 'gutsumm', 'pfirst', 'right', 'state', 'book',
    // 'contents', 'preface1', 'preface2',
    // 'extracts', 'mynote', 'letterdate', 'letter1', 'titlepage',
    // 'contents', 'centered', 'poem', 'figcenter', 'blockquot',
    // 'stanza', 'book', 'title', 'title2',
    // // TODO: handle properly !!!
    // 'footnote', 'toc',
];

const standardAttrs: ObjectMatcher<IntermAttrs> = {
    class: standardClass,
};

type ExpectedAttrsMap = {
    [k in IntermNodeKey]?: {
        [k: string]: ValueMatcher<string>,
        class?: CompoundMatcher<string>,
    };
};
const expectedAttrsMap: ExpectedAttrsMap = {
    a: {
        class: [
            'pginternal', 'x-ebookmaker-pageno',
        ],
        tag: null, href: null,
        // TODO: double check
        title: null,
    },
    pph: {
        class: [
            'pgmonospaced', 'pgheader',
        ],
        'xml:space': 'preserve',
    },
    container: {
        class: [
            'mynote', 'extracts',
        ],
    },
};
