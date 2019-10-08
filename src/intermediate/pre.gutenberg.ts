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
                interm: 'named',
                name: 'small',
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
                    case 'alt': case 'title': case 'src': case 'tag':
                        return {};
                }
                break;
            case 'named':
                switch (node.name) {
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
                                    case 'GutSmall':
                                        return {};
                                }
                                break;
                        }
                        break;

                    case 'ins':
                        switch (attr) {
                            case 'title': return {};
                        }
                        break;
                }
                break;
            default:
                assertNever(name);
                break;
        }

        return {
            diag: {
                diag: 'unexpected-attr', node: node.interm, name: (node as any).name,
                attr, value,
            },
        };
    });
}
