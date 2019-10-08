import {
    stepsProcessor, processSpan,
    hasClass, markAsJunk, processAttrs,
} from './utils';
import { IntermProcessor, ProcResolver } from './intermParser';
import { reject, yieldNext, makeStream, choice } from '../combinators';
import { IntermContainer } from './intermediateNode';
import { assertNever } from 'booka-common';

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
    markAsJunk('chapterhead'),
    checkAttrs(),
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

// Check attrs:

function checkAttrs() {
    return processAttrs((node, attr, value) => {
        switch (attr) {
            case 'style': return {}; // Ignore custom styles
            case 'id': return {}; // Everyone can have an id
            case 'class':
                // Ignore standard: i11, c7, z1...
                if (value.match(/[icz]\d*$/)) { return {}; }
                break;
        }

        switch (node.interm) {
            case 'pph':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'intro':
                                return { flag: 'chapter-abstract' };
                            case 'footer':
                                return { flag: 'footer' };
                            case 'poem': case 'poem1':
                            case 'verse': case 'poetry':
                            case 'stanza':
                                return { flag: 'poem' };
                            case 'letter': case 'letter1':
                                return { flag: 'letter' };
                            // TODO: handle ?
                            case 'letterdate':
                            case 'preface1': case 'preface2':
                            case 'center': // as formating ?
                            case 'gapshortline': // as separator ?
                            case 'gutindent': case 'gutsumm': // as list items ?
                            case 'noindent':
                            case 'footnote':
                            // Ignore
                            case 'state':
                            case 'gapspace': case 'chapterhead':
                            case 'pgmonospaced': case 'pgheader':
                            case 'fig': case 'figleft': case 'figcenter':
                            case 'contents':
                            case 'foot': case 'finis':
                            case 'right': case 'pfirst':
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
                            case 'poem': case 'stanza':
                                return { flag: 'poem' };
                            case 'contents': case 'book':
                            case 'title': case 'title2':
                            case 'centered':
                                return {};
                        }
                        break;
                }
                break;
            case 'separator':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'tiny': case 'short': case 'main':
                            case 'break': case 'full':
                                return {};
                        }
                        break;
                }
                break;
            case 'table':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'center':
                                return {};
                            case 'illus':
                                return { flag: 'illustrations' };
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
                        }
                        break;
                    case 'border': case 'width':
                    case 'cellpadding': case 'cellspacing':
                        return {};
                }
                break;
            case 'cell':
                switch (attr) {
                    case 'colspan': // TODO: handle ?
                    case 'align': case 'valign':
                        return {};
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
                    case 'alt': case 'title': case 'src': case 'tag':
                    case 'width':
                        return {};
                    case 'class':
                        switch (value) {
                            case 'floatright':
                                return {};
                        }
                        break;
                }
                break;
            case 'link':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'citation': case 'footnote':
                            case 'pginternal': case 'x-ebookmaker-pageno':
                                return {};
                        }
                        break;
                    case 'href': case 'title': case 'tag':
                        return {};
                }
            case 'edit':
                switch (attr) {
                    case 'title': return {};
                }
                break;
            case 'header':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            case 'title':
                                return {};
                        }
                        break;
                }
                break;
            case 'text':
            case 'quote':
            case 'italic': case 'bold': case 'big': case 'small': case 'sup': case 'sub':
            case 'span':
                switch (attr) {
                    case 'class':
                        switch (value) {
                            // Ignore:
                            case 'smcap': case 'indexpageno':
                            case 'GutSmall': case 'caps': case 'dropcap':
                            case 'imageref':
                                return {};
                        }
                        break;
                }
                break;
            case 'row': case 'item':
                break;
            case 'ignore':
                break;
            default:
                assertNever(node);
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
