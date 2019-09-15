import { ParagraphNode, compoundSpan, flatten, GroupNode } from 'booka-common';
import {
    yieldLast, headParser, reject, choice, oneOrMore, translate,
    namedParser, envParser, fullParser, expectEmpty,
    compoundDiagnostic, ParserDiagnostic, projectFirst, seq, some,
} from '../combinators';
import { isWhitespaces } from '../utils';
import { xmlElementParser } from './treeParser';
import { spanContent, span } from './spanParser';
import { XmlTree, tree2String } from '../xmlStringParser';
import { Tree2ElementsParser, EpubTreeParser, buildRef } from './utils';
import { BookElement, ContentElement, TitleElement, TitleOrContentElement, isTitleOrContentElement } from '../bookElementParser';
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
        class: null, id: null,
        'xml:space': 'preserve',
    },
    spanContent,
    ([el, spans]) => yieldLast(spans),
);
const pphSpans = choice(wrappedSpans, oneOrMore(span));

const pphNode: EpubTreeParser<ParagraphNode> = translate(
    pphSpans,
    spans => ({
        node: 'paragraph',
        span: compoundSpan(spans),
    })
);

const pphElement: Tree2ElementsParser = namedParser('pph', translate(
    pphNode,
    pNode => [{
        element: 'content',
        content: pNode,
    }],
));

const blockquote: Tree2ElementsParser = xmlElementParser(
    'blockquote',
    {
        cite: null,
    },
    projectFirst(seq(some(pphNode), expectEmpty)),
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

const containerElement: Tree2ElementsParser = namedParser('container', envParser(env => {
    return xmlElementParser(
        ['p', 'div', 'span'],
        {
            id: null, class: null,
            'xml:space': 'preserve',
        },
        fullParser(env.recursive),
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
    expectEmpty,
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
    expectEmpty,
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
    });

const headerTitleParser: EpubTreeParser<string[]> = input => {
    const result = extractTitle(input ? input.stream : []);

    const emptyTitleDiag = result.lines.length === 0
        ? { diag: 'no-title', nodes: input && input.stream }
        : undefined;
    return yieldLast(result.lines, compoundDiagnostic([...result.diags, emptyTitleDiag]));
};

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

const ignore: Tree2ElementsParser = xmlElementParser(
    ['sup', 'sub', 'ul', 'li', 'br', 'hr'], // TODO: do not ignore
    { class: null },
    () => yieldLast(undefined), // TODO: do not ignore children
    () => yieldLast([]),
);

const skip: Tree2ElementsParser = headParser((node, env) => {
    return yieldLast([], { diag: 'unexpected-node', xml: tree2String(node) });
});

const nodeParsers: Tree2ElementsParser[] = [
    skipWhitespaces,
    pphElement,
    img, image, header, svg,
    blockquote,
    containerElement,
    ignore, skip,
];

export const nodeParser = choice(...nodeParsers);

// TODO: remove ?
function extractTitle(nodes: XmlTree[]) {
    const lines: string[] = [];
    const diags: ParserDiagnostic[] = [];
    for (const node of nodes) {
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
                        const fromElement = extractTitle(node.children);
                        lines.push(fromElement.lines.join(''));
                        diags.push(...fromElement.diags);
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

    return { lines, diags };
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
