import {
    stepsProcessor, assignSemantic,
    flagClass, processSpan,
    hasClass, expectAttrsMap, ExpectedAttrsMap, ExpectedAttrs, assignSemanticForClass,
} from './utils';
import { CompoundMatcher } from '../utils';
import { IntermProcessor, ProcResolver } from './intermParser';
import { reject, yieldNext, makeStream, choice } from '../combinators';
import { IntermContainer } from './intermediateNode';

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
    flagClass('extracts', 'extracts'),
    assignSemanticForClass('mynote', {
        semantic: 'tech-note',
        source: 'project-gutenberg',
    }),
    assignSemantic(node =>
        node.attrs['xml:space'] === 'preserve'
            ? { semantic: 'formated' }
            : undefined,
    ),
    expectAttrsMap(expectations()),
]);

const gutenbergPrep: IntermProcessor = choice(
    footnote(),
    steps,
);
export const gutenberg: ProcResolver = ({ rawMetadata }) => {
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

function expectations(): ExpectedAttrsMap {
    const classes: CompoundMatcher<string> = [
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
    const base: ExpectedAttrs = {
        class: classes,
    };
    const forSpan: ExpectedAttrs = {
        class: [
            ...classes,
            'GutSmall',
        ],
    };
    return {
        text: forSpan,
        ins: forSpan, quote: forSpan, image: forSpan,
        big: forSpan, small: forSpan, italic: forSpan, bold: forSpan,
        sub: forSpan, sup: forSpan,
        span: forSpan,
        a: {
            class: [
                ...forSpan.class,
                'pginternal', 'x-ebookmaker-pageno',
            ],
            tag: null, href: null,
            // TODO: double check
            title: null,
        },
        pph: {
            class: [
                ...classes,
                'pgmonospaced', 'pgheader',
                'gapshortline', // TODO: handle as separator ?
                // Ignore:
                'gapspace',
            ],
            'xml:space': 'preserve',
        },
        container: {
            class: [
                ...classes,
                // Handling:
                'mynote', 'extracts',
            ],
        },
        separator: {
            class: ['short'],
        },
        header: base,
        table: {
            class: [],
            border: null, cellpadding: null,
            summary: '',
        },
        row: base, cell: base,
        list: {
            class: ['none', 'nonetn'],
        },
        item: base,
        ignore: base,
    };
}

// Special parsers:

function footnote(): IntermProcessor {
    return ({ stream, env }) => {
        const [first, second] = stream;
        if (second === undefined || first.interm !== 'pph' || second.interm !== 'pph' || second.attrs.class !== 'foot') {
            return reject();
        }
        const ch = first.content[0];
        const id = ch !== undefined && ch.attrs.id !== undefined
            ? ch.attrs.id
            : undefined;

        if (id === undefined) {
            return reject();
        } else {
            // NOTE: ugly mutation
            ch.attrs.id = undefined;

            const secondCh = second.content[0];
            let title: string[] = [];
            if (secondCh !== undefined && secondCh.interm === 'text' && secondCh.content.endsWith(' (')) {
                title = [secondCh.content.substr(0, secondCh.content.length - 2)];
                // NOTE: ugly mutation
                secondCh.content = '(';
            }
            const container: IntermContainer = {
                interm: 'container',
                content: [first, second],
                attrs: { id },
                semantics: [{
                    semantic: 'footnote',
                    title,
                }],
            };
            return yieldNext([container], makeStream(
                stream.slice(2),
                env,
            ));
        }
    };
}
