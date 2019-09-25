import { ParagraphNode, compoundSpan, flatten, GroupNode, BookContentNode, makePph } from 'booka-common';
import {
    yieldLast, headParser, reject, choice, oneOrMore, translate,
    namedParser, envParser, fullParser, expectEoi,
    compoundDiagnostic, ParserDiagnostic, expectParseAll, some, expected, projectFirst, endOfInput, seq, Stream, makeStream, diagnosticContext,
} from '../combinators';
import { isWhitespaces } from '../utils';
import { xmlElementParser, whitespaced } from './treeParser';
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

const wrappedSpans = xmlElementParser(
    ['p', 'span', 'div'],
    {
        class: ['p', 'p1', 'empty-line'],
        id: null,
        'xml:space': 'preserve',
    },
    spanContent,
    ([el, spans]) => yieldLast(spans),
);
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

const blockquote: Tree2ElementsParser = xmlElementParser(
    'blockquote',
    {
        cite: null,
    },
    projectFirst(seq(some(paragraphNode), endOfInput())),
    ([xml, pphs], e) => {
        const node: GroupNode = {
            node: 'group',
            nodes: pphs,
            semantic: 'quote',
            source: xml.attributes.cite,
        };
        return yieldLast([{
            element: 'content',
            content: node,
        }]);
    }
);

const li = xmlElementParser(
    'li',
    {},
    expectSpanContent,
    ([_, itemSpan]) => yieldLast(itemSpan),
);
const listElement = xmlElementParser(
    ['ol', 'ul'],
    { class: ['none', 'nonetn', 'c9', undefined] },
    expectParseAll(some(whitespaced(li)), stream2string),
    ([xml, items]) => yieldLast<BookElement[]>([{
        element: 'content',
        content: {
            node: 'list',
            kind: xml.name === 'ol' ? 'ordered' : 'basic',
            items,
        },
    }]),
);

const tableCell = xmlElementParser(
    ['td', 'th'],
    { class: null },
    expected(pphSpans, []),
    ([_, s]) => yieldLast(compoundSpan(s)),
);

const tr = xmlElementParser(
    'tr',
    { class: null },
    expectParseAll(some(whitespaced(tableCell)), stream2string),
    ([_, cells]) => yieldLast(cells),
);

const tableBodyContent = expectParseAll(some(whitespaced(tr)), stream2string);

const tbody = xmlElementParser(
    'tbody',
    {},
    tableBodyContent,
    ([_, rows]) => yieldLast(rows),
);

const tableBody = choice(tbody, tableBodyContent);

const table: Tree2ElementsParser = xmlElementParser(
    'table',
    {
        summary: null,
        class: null,
        border: null, cellpadding: null,
    },
    expectParseAll(whitespaced(tableBody), stream2string),
    ([_, rows]) => yieldLast(fromContent({
        node: 'table',
        rows,
    })),
);

const hr = xmlElementParser(
    'hr',
    { class: ['main', 'short', 'tiny', 'break', undefined] },
    expectEoi(stream2string),
    () => yieldLast(fromContent({
        node: 'separator',
    })),
);

const containerElement: Tree2ElementsParser = namedParser('container', envParser(env => {
    return xmlElementParser(
        ['p', 'div', 'span', 'blockquote'],
        {
            id: null, class: null,
            'xml:space': 'preserve',
        },
        fullParser(env.nodeParser),
        ([xml, ch], e) => {
            return yieldLast(buildContainerElements(
                flatten(ch),
                buildRef(e.filePath, xml.attributes.id),
            ));
        }
    );
}));

const img: Tree2ElementsParser = xmlElementParser(
    'img',
    { src: null, alt: null, class: null },
    expectEoi('img-children'),
    ([xml]) => {
        const src = xml.attributes['src'];
        if (src) {
            return yieldLast([{
                element: 'content',
                content: {
                    node: 'image-ref',
                    imageId: src,
                    imageRef: src,
                },
            }]);
        } else {
            return yieldLast([], { diag: 'img-must-have-src', node: xml });
        }
    });

const image: Tree2ElementsParser = xmlElementParser(
    'image',
    {},
    expectEoi('image-children'),
    ([xml]) => {
        const xlinkHref = xml.attributes['xlink:href'];
        if (xlinkHref) {
            return yieldLast([{
                element: 'content',
                content: {
                    node: 'image-ref',
                    imageId: xlinkHref,
                    imageRef: xlinkHref,
                },
            }]);
        } else {
            return yieldLast([], { diag: 'image-must-have-xlinkhref', node: xml });
        }
    }
);

const header: Tree2ElementsParser = xmlElementParser(
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    { id: null },
    headerTitleParser,
    ([xml, title]) => {
        const level = parseInt(xml.name[1], 10);
        return yieldLast([{
            element: 'chapter-title',
            title: title,
            level: 4 - level,
        }]);
    });

const svg: Tree2ElementsParser = xmlElementParser(
    'svg',
    { viewBox: null, xmlns: null, class: null },
    () => yieldLast(undefined),
    () => yieldLast([])
);

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
                    case 'em': case 'strong': case 'big':
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
