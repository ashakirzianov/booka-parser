import { AttributeName, Span } from 'booka-common';
import { XmlTree, path, xmlChildren, xmlElementParser } from '../xmlParser';
import {
    choice, makeStream, fullParser,
    reject, headParser, envParser, translate, some, expected, empty, flattenResult, yieldLast, StreamParser, diagnosticContext, declare, Stream,
} from '../combinators';
import { isWhitespaces, flatten, AsyncIter } from '../utils';
import { buildRef } from './sectionParser.utils';
import { EpubSection } from './epubBook';
import { ParserDiagnostic, compoundDiagnostic } from '../combinators/diagnostics';
import { EpubNodeParser, EpubNodeParserEnv, EpubBookParser } from './epubBookParser';
import { RawBookNode } from '../rawNodesParser';

export type SectionsParser = StreamParser<EpubSection, RawBookNode[], undefined>;

export const sectionsParser: EpubBookParser<RawBookNode[]> = async input => {
    const hooks = input.options[input.epub.kind].nodeHooks;
    const hooksParser = choice(...hooks);
    const nodeParser = choice(hooksParser, standardParser);
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

const skipWhitespaces: EpubNodeParser = headParser(node => {
    if (node.type !== 'text') {
        return reject();
    }
    if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
        return yieldLast([]);
    } else {
        return reject();
    }
});

type EpubSpanParser = EpubNodeParser<Span>;
const span = declare<Stream<XmlTree, EpubNodeParserEnv>, Span>();
const text: EpubSpanParser = headParser(node => {
    return node.type === 'text'
        ? yieldLast(node.text)
        : reject();
});

const italic = attrsSpanParser(['em', 'i'], ['italic'], span);
const bold = attrsSpanParser(['strong', 'b'], ['bold'], span);
const quote = attrsSpanParser(['q'], ['quote'], span);
const small = attrsSpanParser(['small'], ['small'], span);
const big = attrsSpanParser(['big'], ['big'], span);
const attr = choice(italic, bold, quote, small, big);

const aSpan: EpubSpanParser = xmlElementParser(
    'a',
    {
        class: null, href: null, title: null, tag: null,
    },
    span,
    ([el, sp]) => {
        if (el.attributes.href !== undefined) {
            return yieldLast({
                span: 'ref',
                refToId: el.attributes.href,
                content: sp,
            });
        } else {
            return yieldLast(sp, { diag: 'bad-anchor', a: el });
        }
    });

span.implementation = choice(text, attr, aSpan);

const normalSpanNode: EpubNodeParser = translate(span, s => [{
    node: 'span',
    span: s,
}]);

const aNode: EpubNodeParser = xmlElementParser(
    'a',
    {
        class: null, href: null,
        id: null, title: null, tag: null,
    },
    span,
    ([el, sp], env) => {
        if (el.attributes.id !== undefined) {
            const childSpan: Span = el.attributes.href === undefined
                ? sp
                : {
                    span: 'ref',
                    refToId: el.attributes.href,
                    content: sp,
                };
            return yieldLast([{
                node: 'compound-raw',
                ref: buildRef(env.filePath, el.attributes.id),
                nodes: [{
                    node: 'span',
                    span: childSpan,
                }],
            }]);
        } else {
            return reject();
        }
    });

const spanNode: EpubNodeParser = choice(aNode, normalSpanNode);

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

const standardParser: EpubNodeParser = choice(
    skipWhitespaces,
    spanNode, pph, img, image, header, br,
    svg, ignore, skip,
);

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

function attrsSpanParser(tagNames: string[], attrs: AttributeName[], contentParser: EpubSpanParser): EpubSpanParser {
    return xmlElementParser(
        tagNames,
        { class: null },
        contentParser,
        ([_, content]) => yieldLast({
            span: 'attrs',
            attrs,
            content,
        }));
}
