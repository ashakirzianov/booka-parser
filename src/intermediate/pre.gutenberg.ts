import {
    stepsProcessor, assignSemantic,
    flagClass, processSpan,
    hasClass, expectAttrsMap, ExpectedAttrsMap, ExpectedAttrs, assignSemanticForClass, markAsJunk, processAttrs,
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
    flagClass('footer', 'footer'),
    flagClass('poem1', 'poem'),
    flagClass('Toc', 'table-of-contents'),
    flagClass('titlepage', 'title-page'),
    assignSemanticForClass('mynote', {
        semantic: 'tech-note',
        source: 'project-gutenberg',
    }),
    assignSemantic(node =>
        node.attrs['xml:space'] === 'preserve'
            ? { semantic: 'formated' }
            : undefined,
    ),
    assignSemantic(node =>
        node.attrs.summary === 'Toc'
            ? { semantic: 'table-of-contents' }
            : undefined,
    ),
    markAsJunk('chapterhead'),
    checkAttrs(),
    // expectAttrsMap(expectations()),
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

function checkAttrs() {
    return processAttrs((node, attr, value) => {
        switch (attr) {
            case 'id': return {}; // Everyone can have an id
            case 'class':
                // Ignore standard: i11, c7, z1...
                if (value.match(/[icz]\d*$/)) { return {}; }
                break;
        }

        switch (node.interm) {
            case 'a':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'pginternal': case 'x-ebookmaker-pageno':
                                return {};
                        }
                        break;
                    case 'href': case 'title': case 'tag':
                        return {};
                }
            case 'span':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            // Ignore:
                            case 'smcap': case 'indexpageno':
                                return {};
                        }
                        break;
                }
                break;
            case 'pph':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'footer':
                                return { flag: 'footer' };
                            case 'poem1':
                                return { flag: 'poem' };
                            // TODO: handle ?
                            case 'letter1': case 'letterdate':
                            case 'center': // as formating ?
                            case 'gapshortline': // as separator ?
                            // Ignore
                            case 'gapspace': case 'chapterhead':
                            case 'pgmonospaced': case 'pgheader':
                                return {};
                        }
                        break;
                    case 'xml:space':
                        switch (value) {
                            case 'preserve': return {};
                        }
                        break;
                }
                break;
            case 'container':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'mynote':
                                return {
                                    semantics: [{
                                        semantic: 'tech-note',
                                        source: 'project-gutenberg',
                                    }],
                                };
                            case 'extracts':
                                return { flag: 'extracts' };
                            case 'titlepage':
                                return { flag: 'title-page' };
                            case 'contents':
                                return {};
                        }
                        break;
                }
                break;
            case 'separator':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'tiny': case 'short': case 'main': case 'break':
                                return {};
                        }
                        break;
                }
                break;
            case 'table':
                switch (attr) {
                    case 'summary':
                        switch (value) {
                            case 'Toc': return { flag: 'table-of-contents' };
                            case '': return {};
                        }
                        break;
                    case 'border': case 'cellpadding':
                        return {};
                }
                break;
            case 'cell':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            // TODO: handle ?
                            case 'right': case 'center':
                            // Ignore:
                            case 'chaptername':
                                return {};
                        }
                        break;
                }
                break;
            case 'list':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'none': case 'nonetn':
                                return {};
                        }
                        break;
                }
                break;
            case 'image':
                switch (attr) {
                    case 'alt': case 'title': case 'src':
                        return {};
                }
                break;
            case 'ins':
                switch (attr) {
                    case 'title': return {};
                }
                break;
        }

        return {
            diag: {
                diag: 'unexpected-attr', node: node.interm,
                attr, value,
            },
        };
    });
}

function expectations(): Partial<ExpectedAttrsMap> {
    const classes: CompoundMatcher<string> = [
        undefined,
        c => c && c.match(/i\d*$/) ? true : false,
        c => c && c.match(/c\d*$/) ? true : false,
        c => c && c.match(/z\d*$/) ? true : false,
        // 'smcap', 'indexpageno',
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
            'GutSmall', 'smcap', 'indexpageno',
            ...classes,
        ],
    };
    return {
        text: forSpan,
        quote: forSpan,
        big: forSpan, small: forSpan, italic: forSpan, bold: forSpan,
        sub: forSpan, sup: forSpan,
        span: forSpan,
        ins: {
            class: [],
            title: null,
        },
        image: {
            class: [],
            src: null, alt: null, title: null,
            tag: null,
        },
        pph: {
            class: [
                // Handling:
                'footer', 'pgmonospaced', 'pgheader', 'poem1',
                'gapshortline', // TODO: handle as separator ?
                // TODO: handle ?
                'letter1', 'letterdate',
                'center', // as formating ?
                // Ignore:
                'gapspace', 'chapterhead',
                ...classes,
            ],
            'xml:space': 'preserve',
        },
        container: {
            class: [
                ...classes,
                // Handling:
                'mynote', 'extracts', 'titlepage',
                // TODO: handle ?
                'contents', // as ToC ?
            ],
        },
        separator: {
            class: ['tiny', 'short', 'main', 'break'],
        },
        header: base,
        table: {
            class: [
                // Handling
                'Toc',
                // Ignore:
                ...classes,
            ],
            border: null, cellpadding: null,
            summary: ['', 'Toc'],
        },
        row: base,
        cell: {
            class: [
                // TODO: handle ?
                'right', 'center',
                // Ignore:
                'chaptername',
                ...classes,
            ],
        },
        list: {
            class: [
                'none', 'nonetn',
                ...classes,
            ],
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
