import { RawBookNode, AttributeName } from 'booka-common';
import { XmlTree, path, xmlChildren, xmlElementParser } from '../xmlParser';
import {
    choice, makeStream, fullParser,
    reject, headParser, envParser, translate, some, expected, empty, flattenResult, yieldLast, StreamParser, diagnosticContext,
} from '../combinators';
import { isWhitespaces, flatten, AsyncIter } from '../utils';
import { buildRef } from './sectionParser.utils';
import { EpubSection } from './epubBook';
import { ParserDiagnostic, compoundDiagnostic } from '../combinators/diagnostics';
import { EpubNodeParser, EpubNodeParserEnv, EpubBookParser } from './epubBookParser';

export type SectionsParser = StreamParser<EpubSection, RawBookNode[], undefined>;

export const sectionsParser: EpubBookParser<RawBookNode[]> = async input => {
    const hooks = input.options[input.epub.kind].nodeHooks;
    const allParsers = hooks.concat(standardParsers);
    const nodeParser = choice(...allParsers);
    const insideParser = flattenResult(fullParser(nodeParser));
    const bodyParser = xmlChildren(insideParser);
    const documentParser = path(['html', 'body'], bodyParser);
    const withDiags = expected(documentParser, [], s => ({ diag: 'couldnt-parse-document', tree: s }));

    const parser: StreamParser<EpubSection, RawBookNode[]> = translate(
        some(headParser(s => {
            const docStream = makeStream(s.content.children, {
                filePath: s.filePath,
                recursive: nodeParser,
            });
            const withContext = diagnosticContext(withDiags, {
                filePath: s.filePath,
            });
            const res = withContext(docStream);
            return res;
        })),
        nns => flatten(nns),
    );

    const sections = await AsyncIter.toArray(input.epub.sections());
    return parser(makeStream(sections));
};

const container = envParser((env: EpubNodeParserEnv) => {
    return translate(
        fullParser(env.recursive),
        nns => ({
            node: 'compound-raw',
            nodes: flatten(nns),
        } as RawBookNode),
    );
});

const text: EpubNodeParser = headParser(node => {
    if (node.type !== 'text') {
        return reject({ diag: 'expected-xml-text' });
    }
    // Skip whitespace nodes
    if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
        return yieldLast([]);
    } else {
        return yieldLast([{
            node: 'span',
            span: node.text,
        }]);
    }
});

const italic = attributeParser(['em', 'i'], ['italic']);
const bold = attributeParser(['strong', 'b'], ['bold']);
const quote = attributeParser(['q'], ['quote']);
const small = attributeParser(['small'], ['small']);
const big = attributeParser(['big'], ['big']);
const attr = choice(italic, bold, quote, small, big);

const a: EpubNodeParser = xmlElementParser(
    'a',
    {
        class: null, href: null,
        id: null, title: null, tag: null,
    },
    container,
    ([el, ch], env) => {
        if (el.attributes.href !== undefined) {
            return yieldLast([{
                node: 'ref',
                to: el.attributes.href,
                content: ch,
            }]);
        } else if (el.attributes.id !== undefined) {
            return yieldLast([{
                node: 'compound-raw',
                ref: buildRef(env.filePath, el.attributes.id),
                nodes: [ch],
            } as RawBookNode]);
        } else {
            return yieldLast([], { diag: 'bad-anchor', a: el });
        }
    });

// TODO: re-implement (do not extra wrap container)
const pph: EpubNodeParser = xmlElementParser(
    ['p', 'div', 'span'],
    {
        class: null, id: null,
        'xml:space': null, // TODO: handle ?
    },
    container,
    ([el, ch], env) => {
        return el.attributes.id
            ? yieldLast([{
                node: 'compound-raw',
                ref: buildRef(env.filePath, el.attributes.id),
                nodes: [ch],
            }])
            : yieldLast([ch]);
    });

const img: EpubNodeParser = xmlElementParser(
    'img',
    { src: null, alt: null, class: null },
    expected(empty(), undefined, i => ({ diag: 'expected-eoi', nodes: i })),
    ([el], env) => {
        const src = el.attributes['src'];
        if (src) {
            return yieldLast([{
                node: 'image-ref',
                imageId: src,
            }]);
        } else {
            return yieldLast([], { diag: 'img-must-have-src', node: el });
        }
    });

const image: EpubNodeParser = xmlElementParser(
    'image',
    {},
    expected(empty(), undefined, i => ({ diag: 'expected-eoi', nodes: i })),
    ([el], env) => {
        const xlinkHref = el.attributes['xlink:href'];
        if (xlinkHref) {
            return yieldLast([{
                node: 'image-ref',
                imageId: xlinkHref,
            }]);
        } else {
            return yieldLast([], { diag: 'image-must-have-xlinkhref', node: el });
        }
    });

const headerTitleParser: EpubNodeParser<string[]> = input => {
    const result = extractTitle(input.stream);

    const emptyTitleDiag = result.lines.length === 0
        ? { diag: 'no-title', nodes: input.stream }
        : undefined;
    return yieldLast(result.lines, compoundDiagnostic([...result.diags, emptyTitleDiag]));
};

const header: EpubNodeParser = xmlElementParser(
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    { id: null },
    headerTitleParser,
    ([el, title], env) => {
        const level = parseInt(el.name[1], 10);
        return yieldLast([{
            node: 'chapter-title',
            title: title,
            level: 4 - level,
        }]);
    });

const br: EpubNodeParser = xmlElementParser(
    'br',
    {},
    expected(empty(), undefined, i => ({ diag: 'expected-eoi', nodes: i })),
    () => yieldLast([{ node: 'span', span: '\n' }]),
);

const svg: EpubNodeParser = xmlElementParser(
    'svg',
    { viewBox: null, xmlns: null, class: null },
    () => yieldLast(undefined),
    () => yieldLast([])
);

const ignore: EpubNodeParser = xmlElementParser(
    ['sup', 'sub', 'ul', 'li', 'br'], // TODO: do not ignore 'br'
    {},
    (expected(empty(), undefined, i => ({ diag: 'expected-eoi', nodes: i }))),
    () => yieldLast([]),
);

const skip: EpubNodeParser = headParser(node => {
    return yieldLast([], { diag: 'unexpected-node', node });
});

const standardParsers = [
    text, attr,
    a, pph, img, image, header, br,
    svg,
    ignore, skip,
];

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
                        diags.push({ diag: 'unexpected-node', node, context: 'title' });
                        break;
                }
                break;
            default:
                diags.push({ diag: 'unexpected-node', node, context: 'title' });
                break;
        }
    }

    return { lines, diags };
}

function attributeParser(tagNames: string[], attrs: AttributeName[]): EpubNodeParser {
    return xmlElementParser(
        tagNames,
        { class: null },
        container,
        ([el, ch], env) => {
            return yieldLast([{
                node: 'attr',
                attributes: attrs,
                content: ch,
            }]);
        });
}
