import { Span, compoundSpan, AttributeName } from 'booka-common';
import {
    declare, translate, seq, some, endOfInput, choice,
    headParser, yieldLast, reject, Stream, expectEoi, projectFirst, maybe, expected,
} from '../combinators';
import { elemChProj, textNode, elemCh } from './treeParser';
import { XmlTree, tree2String } from '../xmlStringParser';
import { TreeParserEnv, Tree2SpanParser, stream2string } from './utils';

export const standardClasses = [
    undefined,
    'p', 'p1', 'v', 'empty-line',
    'dropcap', 'drop',
    'section1', 'section2', 'section3', 'section4', 'section5', 'section6',
    // Project Gutenberg:
    'i2', 'i4', 'i6', 'i8', 'i10', 'i16', 'i20', 'i21',
    'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11',
    'pgmonospaced', 'center', 'pgheader', 'fig', 'figleft',
];

export const span = declare<Stream<XmlTree, TreeParserEnv>, Span>('span');

export const spanContent = projectFirst(seq(some(span), endOfInput(stream2string)));
export const expectSpanContent: Tree2SpanParser = translate(
    projectFirst(seq(
        some(choice(span, headParser(
            el =>
                yieldLast('', { diag: 'unexpected-xml', xml: tree2String(el) })
        ))),
        expected(endOfInput(), undefined),
    )),
    compoundSpan,
);

const text: Tree2SpanParser = headParser(node => {
    return node.type === 'text'
        ? yieldLast(node.text)
        : reject();
});

const italic = attrsSpanParser(['em', 'i'], ['italic'], expectSpanContent);
const bold = attrsSpanParser(['strong', 'b'], ['bold'], expectSpanContent);
const quote = attrsSpanParser(['q'], ['quote'], expectSpanContent);
const small = attrsSpanParser(['small'], ['small'], expectSpanContent);
const big = attrsSpanParser(['big'], ['big'], expectSpanContent);
const sup = attrsSpanParser(['sup'], ['superscript'], expectSpanContent);
const sub = attrsSpanParser(['sub'], ['subscript'], expectSpanContent);
const attr = choice(italic, bold, quote, small, big, sup, sub);

const brTag = elemCh({
    name: 'br',
    expectedClasses: undefined,
    children: expectEoi(stream2string),
});
const brSpan = translate(
    seq(brTag, maybe(textNode())),
    ([_, nextText]) => nextText === undefined
        ? '\n'
        : '\n' + nextText.trimLeft(),
);

const correctionSpan: Tree2SpanParser = elemChProj({
    name: 'ins',
    expectedClasses: undefined,
    expectedAttrs: { title: null },
    children: expectSpanContent,
    project: (content, xml) => ({
        span: 'compound',
        spans: [content],
        semantic: {
            correction: {
                note: xml.attributes.title,
            },
        },
    }),
});

const spanSpan: Tree2SpanParser = elemChProj({
    name: 'span',
    expectedClasses: [
        ...standardClasses,
        // TODO: do not ignore ?
        'smcap', 'GutSmall', 'caps',
    ],
    expectedAttrs: {
        id: null,
        href: null, title: null, tag: null,
    },
    children: spanContent,
    project: children => compoundSpan(children),
});
const aSpan: Tree2SpanParser = elemChProj({
    name: 'a',
    expectedClasses: [
        ...standardClasses, 'a',
        // TODO: do not ignore ?
        'pginternal', 'x-ebookmaker-pageno', 'footnote',
        'citation',
    ],
    expectedAttrs: {
        id: null,
        href: null, title: null, tag: null,
    },
    children: spanContent,
    project: (children, element) => {
        const content = compoundSpan(children);
        if (element.attributes.href !== undefined) {
            return {
                span: 'ref',
                refToId: element.attributes.href,
                content,
            };
        } else {
            return content;
        }
    },
});

span.implementation = choice(
    text, attr, brSpan,
    correctionSpan, aSpan, spanSpan,
);

function attrsSpanParser(tagNames: string[], attrs: AttributeName[], contentParser: Tree2SpanParser): Tree2SpanParser {
    return elemChProj({
        name: tagNames,
        expectedClasses: [
            ...standardClasses,
            // TODO: do not ignore?
            'smcap', 'GutSmall',
        ],
        expectedAttrs: { id: null },
        children: contentParser,
        project: (children) => ({
            span: 'attrs',
            attrs,
            content: children,
        }),
    });
}
