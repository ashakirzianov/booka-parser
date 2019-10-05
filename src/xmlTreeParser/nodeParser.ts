import {
    compoundSpan, flatten, GroupNode,
    BookContentNode, makePph, SimpleParagraphNode,
} from 'booka-common';
import {
    yieldLast, headParser, reject, choice, oneOrMore, translate,
    envParser, compoundDiagnostic, ParserDiagnostic, some, Stream,
    makeStream, seq, projectLast, diagnosticContext,
} from '../combinators';
import { isWhitespaces } from '../utils';
import { elemCh, elemChProj, elemProj } from './treeParser';
import { spanContent, span, standardClasses } from './spanParser';
import { XmlTree, tree2String } from '../xmlStringParser';
import { Tree2ElementsParser, EpubTreeParser, buildRef } from './utils';
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
    onChildrenTail: 'break',
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

const pphs = some(paragraphNode);
const blockquote: Tree2ElementsParser = elemChProj({
    context: 'blockquote',
    name: 'blockquote',
    expectedAttrs: { cite: null },
    children: pphs,
    onChildrenTail: 'break',
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
    children: spanContent,
});

const lis = some(li);
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
            items: children.map(ch => ({
                item: compoundSpan(ch),
            })),
        },
    }],
});

const cellContent = some(pphSpans);
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

const tr = elemCh({
    context: 'table row',
    name: 'tr',
    children: some(tableCell),
});

const tableIgnore = elemProj({
    name: ['colgroup', 'col'],
    project: () => undefined,
});
const tbodyTag = elemCh({
    name: 'tbody',
    children: some(tr),
});
const tbody = projectLast(
    seq(some(tableIgnore), tbodyTag),
);

const tableContent = choice(tbody, some(tr));
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
        rows: children.map(ch => ({
            cells: ch,
        })),
    }),
});

const hr = elemProj({
    context: 'separator',
    name: 'hr',
    expectedClasses: [
        ...standardClasses,
        'main', 'short', 'tiny', 'break', 'full',
        // TODO: do not ignore ?
        'title',
    ],
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
        children: some(environment.nodeParser),
        project: (children: BookElement[][], element) => {
            const flatChildren = flatten(children);
            return buildContainerElements(
                flatChildren,
                buildRef(environment.filePath, element.attributes.id),
            );
        },
    });
});

const img: Tree2ElementsParser = elemProj({
    name: 'img',
    expectedClasses: [undefined, 'floatright', 'z1'],
    expectedAttrs: {
        src: src => src ? true : false,
        alt: null, tag: null, title: null, width: null,
    },
    project: xml => {
        const src = xml.attributes['src'];
        if (src) {
            return [{
                element: 'content',
                content: {
                    node: 'image',
                    image: {
                        kind: 'ref',
                        ref: src,
                        imageId: src,
                        title: xml.attributes.title || xml.attributes.alt,
                    },
                },
            }];
        } else {
            return [];
        }
    },
});

const image: Tree2ElementsParser = elemProj({
    name: 'image',
    expectedAttrs: {
        'xlink:href': href => href ? true : false,
    },
    project: xml => {
        const xlinkHref = xml.attributes['xlink:href'];
        if (xlinkHref) {
            return [{
                element: 'content',
                content: {
                    node: 'image',
                    image: {
                        kind: 'ref',
                        ref: xlinkHref,
                        imageId: xlinkHref,
                        title: xml.attributes.title || xml.attributes.alt,
                    },
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
