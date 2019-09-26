import { ParagraphNode, compoundSpan, flatten, GroupNode, BookContentNode, makePph, Span } from 'booka-common';
import {
    yieldLast, headParser, reject, choice, oneOrMore, translate,
    envParser, fullParser, expectEoi, compoundDiagnostic,
    ParserDiagnostic, expectParseAll, some, expected, Stream, makeStream, projectFirst, seq, endOfInput,
} from '../combinators';
import { isWhitespaces } from '../utils';
import { elemCh, elemChProj, whitespaced } from './treeParser';
import { spanContent, span, expectSpanContent } from './spanParser';
import { XmlTree, tree2String, XmlTreeElement } from '../xmlStringParser';
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
    expectedClasses: [
        undefined, 'p', 'p1', 'v', 'empty-line', 'drop',
        // Project Gutenberg:
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11',
        'pgmonospaced', 'center', 'pgheader',
        // TODO: do not ignore ?
        'letterdate', 'letter1', 'titlepage', 'footer', 'intro',
        'poem', 'poem1', 'gapspace', 'gapshortline', 'noindent',
        'figcenter', 'stanza', 'foot', 'letter', 'gutindent', 'poetry',
        'finis', 'verse', 'gutsumm', 'pfirst',
        // TODO: handle properly !!!
        'footnote', 'toc',
    ],
    expectedAttrs: {
        style: null,
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

const pphElement: Tree2ElementsParser = translate(
    paragraphNode,
    pNode => [{
        element: 'content',
        content: pNode,
    }],
);

const pphs = projectFirst(seq(some(paragraphNode), endOfInput()));
const blockquote: Tree2ElementsParser = elemChProj({
    context: 'blockquote',
    name: 'blockquote',
    expectedAttrs: { cite: null },
    children: pphs,
    project: (children, element) => {
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
});

const li = elemCh({
    name: 'li',
    children: expectSpanContent,
});

const lis = expectParseAll(some(whitespaced(li)), stream2string);
const listElement: Tree2ElementsParser = elemChProj({
    name: ['ol', 'ul'],
    expectedClasses: [
        undefined,
        // Project Gutenberg:
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9',
        'none', 'nonetn',
        // TODO: properly support
        'toc',
    ],
    children: lis,
    project: (children, element) => [{
        element: 'content',
        content: {
            node: 'list',
            kind: element.name === 'ol' ? 'ordered' : 'basic',
            items: children,
        },
    }],
});

const cellContent = expected(pphSpans, []);
const tableCell = elemChProj({
    name: ['td', 'th'],
    expectedClasses: [
        undefined,
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
    ],
    expectedAttrs: {
        align: null, valign: null, colspan: null,
    },
    children: cellContent,
    project: children =>
        compoundSpan(children),
});

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

const tableContent = expectParseAll(whitespaced(tableBody), stream2string);
const table: Tree2ElementsParser = elemChProj({
    name: 'table',
    expectedClasses: [
        undefined,
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
    ],
    expectedAttrs: {
        border: null, cellpadding: null, cellspacing: null, width: null,
        summary: [undefined, ''],
    },
    children: tableContent,
    project: children => fromContent({
        node: 'table',
        rows: children,
    }),
});

const hr = elemChProj({
    name: 'hr',
    expectedClasses: [
        undefined,
        // Project Gutenberg:
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7',
        'main', 'short', 'tiny', 'break',
    ],
    children: expectEoi(stream2string),
    project: () => fromContent({
        node: 'separator',
    }),
});

const containerElement: Tree2ElementsParser = envParser(environment => {
    return elemChProj({
        context: 'container-element',
        name: ['p', 'div', 'span', 'blockquote', 'a'],
        expectedClasses: [
            undefined, 'image',
            'section1', 'section2', 'section3', 'section4', 'section5', 'section6',
            // Project Gutenberg:
            'fig', 'figleft',
            'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
            // TODO: do not ignore ?
            'extracts', 'mynote', 'letterdate', 'letter1', 'titlepage',
            'contents', 'centered', 'poem', 'figcenter', 'blockquot',
            'stanza',
        ],
        expectedAttrs: {
            id: null,
            tag: null,
            'xml:space': [undefined, 'preserve'],
        },
        children: fullParser(environment.nodeParser),
        project: (children: BookElement[][], element) => {
            const flatChildren = flatten(children);
            return buildContainerElements(
                flatChildren,
                buildRef(environment.filePath, element.attributes.id),
            );
        },
    });
});

const img: Tree2ElementsParser = elemChProj({
    name: 'img',
    expectedClasses: [undefined, 'floatright', 'z1'],
    expectedAttrs: {
        src: src => src ? true : false,
        alt: null, tag: null, title: null, width: null,
    },
    children: expectEoi('img-children'),
    project: (_, xml) => {
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
});

const image: Tree2ElementsParser = elemChProj({
    name: 'image',
    expectedAttrs: {
        'xlink:href': href => href ? true : false,
    },
    children: expectEoi('image-children'),
    project: (_, xml) => {
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
});

const header: Tree2ElementsParser = elemChProj({
    name: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    expectedClasses: [
        undefined,
        // Project Gutenberg:
        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
    ],
    expectedAttrs: {
        id: null, style: null,
    },
    children: headerTitleParser,
    project: (title, xml) => {
        const level = parseInt(xml.name[1], 10);
        return [{
            element: 'chapter-title',
            title: title,
            level: 4 - level,
        }];
    },
});

const svg: Tree2ElementsParser = elemCh({
    name: 'svg',
    expectedAttrs: { viewBox: null, xmlns: null },
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
