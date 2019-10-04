import {
    compoundSpan, flatten, GroupNode,
    BookContentNode, makePph, SimpleParagraphNode,
} from 'booka-common';
import {
    yieldLast, headParser, reject, choice, oneOrMore, translate,
    envParser, fullParser, compoundDiagnostic,
    ParserDiagnostic, some, expected, Stream, makeStream, projectFirst, seq, endOfInput, projectLast, diagnosticContext,
} from '../combinators';
import { isWhitespaces } from '../utils';
import { elemCh, elemChProj, whitespaced, elemProj, expectParseAll, expectEoi } from './treeParser';
import { spanContent, span, expectSpanContent, standardClasses } from './spanParser';
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
    expectedClasses: [
        ...standardClasses,
        // TODO: do not ignore ?
        'letterdate', 'letter1', 'titlepage', 'footer', 'intro',
        'poem', 'poem1', 'gapspace', 'gapshortline', 'noindent',
        'figcenter', 'stanza', 'foot', 'letter', 'gutindent', 'poetry',
        'finis', 'verse', 'gutsumm', 'pfirst', 'right', 'state', 'book',
        'contents', 'preface1', 'preface2',
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
const pphSpans = diagnosticContext(
    choice(wrappedSpans, oneOrMore(span)),
    'paragraph spans',
);

export const paragraphNode: EpubTreeParser<SimpleParagraphNode> = translate(
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
            semantic: {
                quote: {
                    signature: element.attributes.cite
                        ? [element.attributes.cite]
                        : [],
                },
            },
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

const lis = expectParseAll(some(whitespaced(li)));
const listElement: Tree2ElementsParser = elemChProj({
    context: 'list',
    name: ['ol', 'ul'],
    expectedClasses: [
        ...standardClasses,
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
            items: children.map(compoundSpan),
        },
    }],
});

const cellContent = expectParseAll(some(pphSpans));
const tableCell = elemChProj({
    context: 'table cell',
    name: ['td', 'th'],
    expectedClasses: standardClasses,
    expectedAttrs: {
        align: null, valign: null, colspan: null,
    },
    children: cellContent,
    project: children => {
        return compoundSpan(children.map(
            (c, idx) =>
                idx !== 0
                    ? compoundSpan(['\n', ...c])
                    : compoundSpan(c)
        ));
    },
});

const rowContent = diagnosticContext(
    expectParseAll(some(whitespaced(tableCell))),
    'row content',
);
const tr = elemCh({
    context: 'table row',
    name: 'tr',
    children: rowContent,
});

const tableBodyContent = expectParseAll(some(whitespaced(tr)));

const tableIgnore = elemProj({
    name: ['colgroup', 'col'],
    project: () => undefined,
});
const tbodyTag = elemCh({
    name: 'tbody',
    children: tableBodyContent,
});
const tbody = projectLast(
    seq(some(whitespaced(tableIgnore)), whitespaced(tbodyTag)),
);

const tableBody = choice(tbody, tableBodyContent);

const tableContent = expectParseAll(whitespaced(tableBody));
const table: Tree2ElementsParser = elemChProj({
    name: 'table',
    expectedClasses: [
        ...standardClasses,
        // TODO: do not ignore ?
        'illus',
    ],
    expectedAttrs: {
        border: null, cellpadding: null, cellspacing: null, width: null,
        summary: [
            undefined, '',
            // TODO: do not ignore ?
            'Illustrations', 'carol',
        ],
    },
    children: tableContent,
    project: children => fromContent({
        node: 'table',
        rows: children,
    }),
});

const hr = elemChProj({
    context: 'separator',
    name: 'hr',
    expectedClasses: [
        ...standardClasses,
        'main', 'short', 'tiny', 'break', 'full',
        // TODO: do not ignore ?
        'title',
    ],
    children: expectEoi(),
    project: () => fromContent({
        node: 'separator',
    }),
});

const containerElement: Tree2ElementsParser = envParser(environment => {
    return elemChProj({
        context: 'container-element',
        name: ['p', 'div', 'span', 'blockquote', 'a'],
        expectedClasses: [
            ...standardClasses,
            'image',
            // TODO: do not ignore ?
            'extracts', 'mynote', 'letterdate', 'letter1', 'titlepage',
            'contents', 'centered', 'poem', 'figcenter', 'blockquot',
            'stanza', 'book', 'title', 'title2',
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
    children: expectEoi(),
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
    children: expectEoi(),
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
        ...standardClasses,
        // TODO: do not ignore ?
        'title',
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
