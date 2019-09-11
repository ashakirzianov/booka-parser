import { ChapterTitle, RawBookNode, AttributeName } from 'booka-common';
import { XmlTree, path, xmlChildren, xmlElementParser } from '../xmlParser';
import {
    choice, makeStream, success, emptyStream, SuccessStreamParser,
    successValue, fail, headParser, envParser, translate, some, reparse, expected, StreamParser,
} from '../combinators';
import { isWhitespaces, flatten } from '../utils';
import { ParserDiagnoser } from '../log';
import {
    EpubNodeParserEnv, EpubNodeParser, fullParser, buildRef,
} from './epubNodeParser';
import { EpubSection } from './epubBook';

export type SectionsParserEnv = {
    ds: ParserDiagnoser,
    hooks: EpubNodeParser[],
};
// TODO: make normal 'StreamParser'
export type SectionsParser = SuccessStreamParser<EpubSection, RawBookNode[], SectionsParserEnv>;

export const sectionsParser: SectionsParser = expected(
    envParser(env => {
        const allParsers = env.hooks.concat(standardParsers);
        const nodeParser = choice(...allParsers);
        const bodyParser = xmlChildren(fullParser(nodeParser));
        const documentParser = path(['html', 'body'], bodyParser);
        const withDiags = expected(documentParser, [], s => ({ custom: 'couldnt-parse-document', tree: s }));

        const parser: SectionsParser = translate(
            some(headParser(s => {
                const docStream = makeStream(s.content.children, {
                    ds: env.ds,
                    filePath: s.filePath,
                    recursive: nodeParser,
                });
                const res = withDiags(docStream);
                return successValue(res.value, res.diagnostic);
            })),
            nns => flatten(nns),
        );

        return parser;
    }),
    [],
);

const container = envParser((env: EpubNodeParserEnv) => {
    return translate(
        fullParser(env.recursive),
        nodes => ({
            node: 'compound-raw',
            nodes,
        } as RawBookNode),
    );
});

const text: EpubNodeParser = headParser(node => {
    if (node.type !== 'text') {
        return fail({ custom: 'expected-xml-text' });
    }
    // Skip whitespace nodes
    if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
        return successValue([]);
    } else {
        return successValue([{
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
            return successValue([{
                node: 'ref',
                to: el.attributes.href,
                content: ch,
            }]);
        } else if (el.attributes.id !== undefined) {
            return successValue([{
                node: 'compound-raw',
                ref: buildRef(env.filePath, el.attributes.id),
                nodes: [ch],
            } as RawBookNode]);
        } else {
            // TODO: add diagnostic
            return successValue([]);
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
            ? successValue([{
                node: 'compound-raw',
                ref: buildRef(env.filePath, el.attributes.id),
                nodes: [ch],
            }])
            : successValue([ch]);
    });

const img: EpubNodeParser = xmlElementParser(
    'img',
    { src: null, alt: null, class: null },
    null,
    ([el], env) => {
        const src = el.attributes['src'];
        if (src) {
            return successValue([{
                node: 'image-ref',
                imageId: src,
            }]);
        } else {
            env.ds.add({
                diag: 'img-must-have-src',
                node: el,
            });
            return successValue([]);
        }
    });

const image: EpubNodeParser = xmlElementParser(
    'image',
    {},
    null,
    ([el], env) => {
        const xlinkHref = el.attributes['xlink:href'];
        if (xlinkHref) {
            return successValue([{
                node: 'image-ref',
                imageId: xlinkHref,
            }]);
        } else {
            env.ds.add({ diag: 'image-must-have-xlinkhref', node: el });
            return successValue([]);
        }
    });

const header: EpubNodeParser = xmlElementParser(
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    { id: null },
    null,
    ([el], env) => {
        const level = parseInt(el.name[1], 10);
        // TODO: Implement as parser
        const title = extractTitle(el.children, env.ds);
        if (title.length === 0) {
            env.ds.add({ diag: 'no-title', node: el });
        }
        return successValue([{
            node: 'chapter-title',
            title: title,
            level: 4 - level,
        }]);
    });

const br: EpubNodeParser = xmlElementParser(
    'br',
    {},
    null,
    () => successValue([{ node: 'span', span: '\n' }]),
);

const svg: EpubNodeParser = xmlElementParser(
    'svg',
    { viewBox: null, xmlns: null, class: null },
    null,
    () => successValue([])
);

const ignore: EpubNodeParser = xmlElementParser(
    ['sup', 'sub', 'ul', 'li', 'br'], // TODO: do not ignore 'br'
    {},
    null,
    () => successValue([]),
);

const skip: EpubNodeParser = headParser(node => {
    return successValue([], { custom: 'unexpected-node', node });
});

const standardParsers = [
    text, attr,
    a, pph, img, image, header, br,
    svg,
    ignore, skip,
];

function extractTitle(nodes: XmlTree[], ds: ParserDiagnoser): ChapterTitle {
    const lines: string[] = [];
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
                        const fromElement = extractTitle(node.children, ds);
                        lines.push(fromElement.join(''));
                        break;
                    case 'br':
                        break;
                    default:
                        ds.add({ diag: 'unexpected-node', node, context: 'title' });
                        break;
                }
                break;
            default:
                ds.add({ diag: 'unexpected-node', node, context: 'title' });
                break;
        }
    }

    return lines;
}

function attributeParser(tagNames: string[], attrs: AttributeName[]): EpubNodeParser {
    return xmlElementParser(
        tagNames,
        { class: null },
        container,
        ([el, ch], env) => {
            return successValue([{
                node: 'attr',
                attributes: attrs,
                content: ch,
            }]);
        });
}
