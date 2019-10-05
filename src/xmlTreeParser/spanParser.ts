import { Span, compoundSpan, AttributeName } from 'booka-common';
import {
    declare, translate, seq, some, choice,
    headParser, yieldLast, reject, Stream, maybe,
} from '../combinators';
import { elemChProj, textNode, TreeParser, elem, elemProj } from './treeParser';
import { XmlTree } from '../xmlStringParser';
import { TreeParserEnv, Tree2SpanParser } from './utils';

export const standardClasses = [
    undefined,
    'p', 'p1', 'v', 'empty-line',
    'dropcap', 'drop',
    'section1', 'section2', 'section3', 'section4', 'section5', 'section6',
    // Project Gutenberg:
    'i2', 'i4', 'i6', 'i8', 'i10', 'i16', 'i20', 'i21',
    'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11',
    'z1',
    'pgmonospaced', 'center', 'pgheader', 'fig', 'figleft',
    'indexpageno', 'imageref', 'image', 'chapterhead',
    'right', 'chaptername', 'illus', 'floatright',
];

export const span = declare<Stream<XmlTree, TreeParserEnv>, Span>('span');

export const spanContent = some(span);

const text: Tree2SpanParser = headParser(node => {
    return node.type === 'text'
        ? yieldLast(node.text)
        : reject();
});

const italic = attrsSpanParser(['em', 'i'], 'italic', spanContent);
const bold = attrsSpanParser(['strong', 'b'], 'bold', spanContent);
const small = attrsSpanParser(['small'], 'small', spanContent);
const big = attrsSpanParser(['big'], 'big', spanContent);
const sup = attrsSpanParser(['sup'], 'sup', spanContent);
const sub = attrsSpanParser(['sub'], 'sub', spanContent);
const attr = choice(italic, bold, small, big, sup, sub);

const imgSpan = elemProj({
    name: 'img',
    expectedClasses: standardClasses,
    expectedAttrs: {
        src: src => src !== undefined,
        alt: null, title: null,
        tag: null, width: null,
    },
    keepWhitespaces: 'both',
    project: (xml): Span => {
        if (xml.attributes.src) {
            return {
                image: {
                    kind: 'ref',
                    ref: xml.attributes.src!,
                    imageId: xml.attributes.src!,
                    title: xml.attributes.title || xml.attributes.alt,
                },
            };
        } else {
            return '';
        }
    },
});

const brTag = elem({
    name: 'br',
    keepWhitespaces: 'both',
    expectedClasses: undefined,
});
const brSpan = translate(
    seq(brTag, maybe(textNode())),
    ([_, nextText]) => nextText === undefined
        ? '\n'
        : '\n' + nextText.trimLeft(),
);

const quoteSpan = elemChProj({
    name: ['q', 'quote'],
    keepWhitespaces: 'both',
    children: spanContent,
    project: (content, xml): Span => ({
        span: compoundSpan(content),
        semantic: {
            quote: {},
        },
    }),
});
const correctionSpan = elemChProj({
    name: 'ins',
    keepWhitespaces: 'both',
    expectedClasses: undefined,
    expectedAttrs: { title: null },
    children: spanContent,
    project: (content, xml): Span => ({
        span: compoundSpan(content),
        semantic: {
            correction: {
                note: xml.attributes.title,
            },
        },
    }),
});

const spanSpan: Tree2SpanParser = elemChProj({
    name: 'span',
    keepWhitespaces: 'both',
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
    onChildrenTail: 'break',
    project: children => compoundSpan(children),
});
const aSpan: Tree2SpanParser = elemChProj({
    name: 'a',
    keepWhitespaces: 'both',
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
    onChildrenTail: 'break',
    project: (children, element): Span => {
        const content = compoundSpan(children);
        if (element.attributes.href !== undefined) {
            return {
                ref: content,
                refToId: element.attributes.href,
            };
        } else {
            return content;
        }
    },
});

span.implementation = choice(
    text, attr, brSpan, imgSpan, quoteSpan,
    correctionSpan, aSpan, spanSpan,
);

function attrsSpanParser(tagNames: string[], attrName: AttributeName, contentParser: TreeParser<Span[], TreeParserEnv>): Tree2SpanParser {
    return elemChProj({
        name: tagNames,
        expectedClasses: [
            ...standardClasses,
            // TODO: do not ignore?
            'smcap', 'GutSmall',
        ],
        expectedAttrs: { id: null },
        keepWhitespaces: 'both',
        children: contentParser,
        project: (children): Span => ({
            [attrName]: compoundSpan(children),
        }),
    });
}
