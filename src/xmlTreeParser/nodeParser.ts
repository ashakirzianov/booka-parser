import { ParagraphNode, compoundSpan, flatten, GroupNode, BookContentNode, makePph } from 'booka-common';
import {
    yieldLast, headParser, reject, choice, oneOrMore, translate,
    envParser, fullParser, expectEoi, compoundDiagnostic,
    ParserDiagnostic, expectParseAll, some, expected, projectFirst, endOfInput, seq, Stream, makeStream, diagnosticContext,
} from '../combinators';
import { isWhitespaces } from '../utils';
import { elemCh, elemChProj, whitespaced } from './treeParser';
import { spanContent, span, expectSpanContent } from './spanParser';
import { XmlTree, tree2String } from '../xmlStringParser';
import { Tree2ElementsParser, EpubTreeParser, buildRef, stream2string } from './utils';
import {
    BookElement, ContentElement, TitleElement,
    TitleOrContentElement, isTitleOrContentElement,
} from '../bookElementParser';
import { partition } from 'lodash';

const skipWhitespaces: Tree2ElementsParser = headParser(node => {
    if (node.type !== 'text') {
        return reject();
    }
    if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
        return yieldLast([]);
    } else {
        return reject();
    }
});

const wrappedSpans = elemCh({
    context: 'wrappedSpans',
    name: ['p', 'span', 'div'],
    expectedAttrs: {
        style: null,
        class: [
            undefined, 'p', 'p1', 'v', 'empty-line', 'drop',
            // Project Gutenberg:
            'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11',
            'pgmonospaced', 'center',
            // TODO: support multiple classes
            'center c1', 'pgmonospaced pgheader', 'noindent c4',
            // TODO: do not ignore ?
            'letterdate', 'letter1', 'titlepage', 'footer', 'intro',
            'poem', 'poem1', 'gapspace', 'gapshortline', 'noindent',
            'figcenter', 'stanza', 'foot', 'letter', 'gutindent', 'poetry',
            'finis', 'verse', 'gutsumm', 'pfirst',
            // TODO: handle properly !!!
            'footnote', 'toc',
        ],
        id: null,
        'xml:space': [undefined, 'preserve'],
    },
    children: spanContent,
});
const pphSpans = choice(wrappedSpans, oneOrMore(span));

export const paragraphNode: EpubTreeParser<ParagraphNode> = translate(
    pphSpans,
    spans => makePph(compoundSpan(spans)),
);

const pphElement: Tree2ElementsParser = diagnosticContext(translate(
    paragraphNode,
    pNode => [{
        element: 'content',
        content: pNode,
    }],
), 'pphElement');

const blockquote: Tree2ElementsParser = elemChProj({
    context: 'blockquote',
    name: 'blockquote',
    expectedAttrs: { cite: null },
    children: projectFirst(seq(some(paragraphNode), endOfInput())),
},
    ({ element, children }) => {
        const node: GroupNode = {
            node: 'group',
            nodes: children,
            semantic: 'quote',
            signature: element.attributes.cite
                ? [element.attributes.cite]
                : [],
        };
        return [{
            element: 'content',
            content: node,
        }];
    },
);

const li = elemCh({
    name: 'li',
    children: expectSpanContent,
});

const listElement: Tree2ElementsParser = elemChProj({
    name: ['ol', 'ul'],
    expectedAttrs: {
        class: [
            undefined,
            // Project Gutenberg:
            'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9',
            'none', 'nonetn',
            // TODO: properly support
            'toc',
        ],
    },
    children: expectParseAll(some(whitespaced(li)), stream2string),
},
    ({ element, children }) => [{
        element: 'content',
        content: {
            node: 'list',
            kind: element.name === 'ol' ? 'ordered' : 'basic',
            items: children,
        },
    }],
);

const tableCell = elemChProj({
    name: ['td', 'th'],
    expectedAttrs: {
        align: null, valign: null, colspan: null,
        class: [
            undefined,
            'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
        ],
    },
    children: expected(pphSpans, []),
},
    ({ children }) => compoundSpan(children),
);

const tr = elemCh({
    name: 'tr',
    children: expectParseAll(some(whitespaced(tableCell)), stream2string),
});

const tableBodyContent = expectParseAll(some(whitespaced(tr)), stream2string);

const tbody = elemCh({
    name: 'tbody',
    children: tableBodyContent,
});

const tableBody = choice(tbody, tableBodyContent);

const table: Tree2ElementsParser = elemChProj({
    name: 'table',
    expectedAttrs: {
        border: null, cellpadding: null, cellspacing: null, width: null,
        summary: [undefined, ''],
        class: [
            undefined,
            'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
        ],
    },
    children: expectParseAll(whitespaced(tableBody), stream2string),
},
    ({ children }) => fromContent({
        node: 'table',
        rows: children,
    }),
);

const hr = elemChProj({
    name: 'hr',
    expectedAttrs: {
        class: [
            undefined,
            // Project Gutenberg:
            'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7',
            'main', 'short', 'tiny', 'break',
        ],
    },
    children: expectEoi(stream2string),
},
    () => fromContent({
        node: 'separator',
    }),
);

const containerElement: Tree2ElementsParser = envParser(environment => {
    return elemChProj({
        name: ['p', 'div', 'span', 'blockquote', 'a'],
        expectedAttrs: {
            id: null,
            tag: null,
            class: [
                undefined, 'image',
                'section1', 'section2', 'section3', 'section4', 'section5', 'section6',
                // Project Gutenberg:
                'fig',
                'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9',
                // TODO: support multiple classes
                'fig c2', 'figleft c7', 'fig c8', 'fig c9', 'fig c10',
                // TODO: do not ignore ?
                'extracts', 'mynote', 'letterdate', 'letter1', 'titlepage',
                'contents', 'centered', 'poem', 'figcenter', 'blockquot',
            ],
            'xml:space': [undefined, 'preserve'],
        },
        children: fullParser(environment.nodeParser),
    },
        ({ element, children }) => {
            const flatChildren = flatten(children);
            return buildContainerElements(
                flatChildren,
                buildRef(environment.filePath, element.attributes.id),
            );
        },
    );
});

const img: Tree2ElementsParser = elemChProj({
    name: 'img',
    expectedAttrs: {
        src: src => src ? true : false,
        alt: null, tag: null, title: null, width: null,
        class: null,
    },
    children: expectEoi('img-children'),
},
    ({ element: xml }) => {
        const src = xml.attributes['src'];
        if (src) {
            return [{
                element: 'content',
                content: {
                    node: 'image-ref',
                    imageId: src,
                    imageRef: src,
                },
            }];
        } else {
            return [];
        }
    },
);

const image: Tree2ElementsParser = elemChProj({
    name: 'image',
    expectedAttrs: {
        'xlink:href': href => href ? true : false,
    },
    children: expectEoi('image-children'),
},
    ({ element: xml }) => {
        const xlinkHref = xml.attributes['xlink:href'];
        if (xlinkHref) {
            return [{
                element: 'content',
                content: {
                    node: 'image-ref',
                    imageId: xlinkHref,
                    imageRef: xlinkHref,
                },
            }];
        } else {
            return [];
        }
    },
);

const header: Tree2ElementsParser = elemChProj({
    name: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    expectedAttrs: {
        id: null, style: null,
        class: [
            undefined,
            // Project Gutenberg:
            'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
        ],
    },
    children: headerTitleParser,
},
    ({ children: title, element: xml }) => {
        const level = parseInt(xml.name[1], 10);
        return [{
            element: 'chapter-title',
            title: title,
            level: 4 - level,
        }];
    },
);

const svg: Tree2ElementsParser = elemCh({
    name: 'svg',
    expectedAttrs: { viewBox: null, xmlns: null, class: null },
    children: () => yieldLast<BookElement[]>([]),
});

const skip: Tree2ElementsParser = headParser((node, env) => {
    return yieldLast([], { diag: 'unexpected-node', xml: tree2String(node) });
});

const nodeParsers: Tree2ElementsParser[] = [
    skipWhitespaces,
    pphElement,
    img, image, header, svg,
    listElement, table, hr,
    blockquote,
    containerElement,
    skip,
];

export const nodeParser = choice(...nodeParsers);

function headerTitleParser({ stream }: Stream<XmlTree, any>) {
    const lines: string[] = [];
    const diags: ParserDiagnostic[] = [];
    for (const node of stream) {
        switch (node.type) {
            case 'text':
                if (!isWhitespaces(node.text)) {
                    lines.push(node.text);
                }
                break;
            case 'element':
                switch (node.name) {
                    case 'em': case 'strong': case 'big': case 'i':
                    case 'a': case 'b':
                    case 'span': case 'div': case 'p':
                        const fromElement = headerTitleParser(makeStream(node.children));
                        lines.push(fromElement.value.join(''));
                        diags.push(fromElement.diagnostic);
                        break;
                    case 'br':
                        break;
                    default:
                        diags.push({ diag: 'unexpected-node', xml: tree2String(node), context: 'title' });
                        break;
                }
                break;
            default:
                diags.push({ diag: 'unexpected-node', xml: tree2String(node), context: 'title' });
                break;
        }
    }

    return yieldLast(lines, compoundDiagnostic(diags));
}

function buildContainerElements(elements: BookElement[], refId?: string): BookElement[] {
    if (!refId) {
        return elements;
    }
    const [contentOrTitle, rest] = partition(elements, isTitleOrContentElement);
    const processed = buildContainerElementsHelper(contentOrTitle, refId);
    return [...processed, ...rest];
}

function buildContainerElementsHelper(elements: TitleOrContentElement[], refId: string): TitleOrContentElement[] {
    const indexOfFirstTitle = elements.findIndex(el => el.element === 'chapter-title');
    if (indexOfFirstTitle < 0) {
        const before = elements as ContentElement[];
        const group: BookElement = {
            element: 'content',
            content: {
                node: 'group',
                refId,
                nodes: before.map(c => c.content),
            },
        };
        return [group];
    } else if (indexOfFirstTitle === 0) {
        const after = elements.slice(1);
        const result = buildContainerElementsHelper(after, refId);
        return [elements[0], ...result];
    } else {
        const before = elements.slice(0, indexOfFirstTitle) as ContentElement[];
        const group: BookElement = {
            element: 'content',
            content: {
                node: 'group',
                refId,
                nodes: before.map(c => c.content),
            },
        };
        const title = elements[indexOfFirstTitle] as TitleElement;
        const after = elements.slice(indexOfFirstTitle + 1);
        return [group, title, ...after];
    }
}

function fromContent(node: BookContentNode): BookElement[] {
    return [{
        element: 'content',
        content: node,
    }];
}
