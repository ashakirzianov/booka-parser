import { ParagraphNode, compoundSpan } from 'booka-common';
import { XmlTree, path, xmlChildren, xmlElementParser } from '../xmlParser';
import {
    choice, makeStream, fullParser, reject, headParser, envParser,
    translate, some, expected, empty, flattenResult, yieldLast,
    StreamParser, diagnosticContext, namedParser, oneOrMore, expectEmpty,
} from '../combinators';
import { isWhitespaces, flatten, AsyncIter } from '../utils';
import { buildRef } from './sectionParser.utils';
import { EpubSection } from './epubBook';
import { ParserDiagnostic, compoundDiagnostic } from '../combinators/diagnostics';
import { EpubNodeParser, EpubBookParser } from './epubBookParser';
import { BookElement } from '../bookElementParser';
import { span, spanContent } from './spanParser';

export type SectionsParser = StreamParser<EpubSection, BookElement[], undefined>;

export const sectionsParser: EpubBookParser<BookElement[]> = async input => {
    const hooks = input.options[input.epub.kind];
    const nodeParser = choice(...hooks.nodeHooks, ...standardNodeParsers);
    const insideParser = flattenResult(fullParser(nodeParser));
    const bodyParser = xmlChildren(insideParser);
    const documentParser = path(['html', 'body'], bodyParser);
    const withDiags = expected(documentParser, [], stream => ({
        diag: 'couldnt-parse-document',
        tree: stream && stream.stream,
    }));

    // TODO: report un-parsed sections
    const parser: StreamParser<EpubSection, BookElement[]> = translate(
        some(headParser(s => {
            const docStream = makeStream(s.content.children, {
                filePath: s.filePath,
                recursive: nodeParser,
                paragraph: pphNode,
                span: span,
            });
            const withContext = diagnosticContext(withDiags, {
                filePath: s.filePath,
            });
            const res = withContext(docStream);
            return res.success
                ? res
                : yieldLast([] as BookElement[], { diag: 'couldnt-parse-section', section: s, inside: res.diagnostic });
        })),
        nns => flatten(nns),
    );

    const sections = await AsyncIter.toArray(input.epub.sections());
    return parser(makeStream(sections));
};

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

const pphNode: EpubNodeParser<ParagraphNode> = translate(
    pphSpans,
    spans => ({
        node: 'paragraph',
        span: compoundSpan(spans),
    })
);

const pphElement: EpubNodeParser = namedParser('pph', translate(
    pphNode,
    pNode => [{
        element: 'content',
        content: pNode,
    }],
));

const containerElement: EpubNodeParser = namedParser('container', envParser(env => {
    return xmlElementParser(
        ['p', 'div', 'span'],
        {
            id: null, class: null,
            'xml:space': 'preserve',
        },
        fullParser(env.recursive),
        ([xml, ch], e) => {
            return yieldLast([{
                refId: buildRef(e.filePath, xml.attributes.id),
                element: 'compound',
                elements: flatten(ch),
            }]);
        }
    );
}));

const img: EpubNodeParser = xmlElementParser(
    'img',
    { src: null, alt: null, class: null },
    expectEmpty,
    ([xml]) => {
        const src = xml.attributes['src'];
        if (src) {
            return yieldLast([{
                element: 'image-ref',
                imageId: src,
            }]);
        } else {
            return yieldLast([], { diag: 'img-must-have-src', node: xml });
        }
    });

const image: EpubNodeParser = xmlElementParser(
    'image',
    {},
    expectEmpty,
    ([xml]) => {
        const xlinkHref = xml.attributes['xlink:href'];
        if (xlinkHref) {
            return yieldLast([{
                element: 'image-ref',
                imageId: xlinkHref,
            }]);
        } else {
            return yieldLast([], { diag: 'image-must-have-xlinkhref', node: xml });
        }
    });

const headerTitleParser: EpubNodeParser<string[]> = input => {
    const result = extractTitle(input ? input.stream : []);

    const emptyTitleDiag = result.lines.length === 0
        ? { diag: 'no-title', nodes: input && input.stream }
        : undefined;
    return yieldLast(result.lines, compoundDiagnostic([...result.diags, emptyTitleDiag]));
};

const header: EpubNodeParser = xmlElementParser(
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

const br: EpubNodeParser = xmlElementParser(
    'br',
    {},
    expected(empty(), undefined, i => ({ diag: 'expected-eoi', nodes: i })),
    () => yieldLast([{ element: 'span', span: '\n' }]),
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

const skip: EpubNodeParser = headParser((node, env) => {
    return yieldLast([], { diag: 'unexpected-node', node });
});

const standardNodeParsers: EpubNodeParser[] = [
    skipWhitespaces,
    pphElement,
    img, image, header, br, svg,
    containerElement,
    ignore, skip,
];

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
