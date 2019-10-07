import {
    declare, some, choice, headParser, yieldLast, reject,
} from '../combinators';
import { elemChProj, TreeParser, elemProj, TreeStream } from './treeParser';
import { IntermSpan, IntermSpanName } from '../intermediate';

//  TODO: move
export const standardClasses = [
    undefined,
    'p', 'p1', 'v', 'empty-line',
    'dropcap', 'drop',
    'section1', 'section2', 'section3', 'section4', 'section5', 'section6',
    //  Project Gutenberg:
    'i2', 'i4', 'i6', 'i8', 'i10', 'i16', 'i20', 'i21',
    'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11',
    'z1',
    'pgmonospaced', 'center', 'pgheader', 'fig', 'figleft',
    'indexpageno', 'imageref', 'image', 'chapterhead',
    'right', 'chaptername', 'illus', 'floatright',
];

type SpanParser = TreeParser<IntermSpan>;
export const span = declare<TreeStream, IntermSpan>('span');

export const spans = some(span);

const text: SpanParser = headParser(node => {
    return node.type === 'text'
        ? yieldLast({
            interm: 'text',
            attrs: {},
            content: node.text,
        })
        : reject();
});

const italic = simple('italic', ['em', 'i']);
const bold = simple('bold', ['strong', 'b']);
const quote = simple('quote', ['q', 'quote']);
const small = simple('small');
const big = simple('big');
const sup = simple('sup');
const sub = simple('sub');
const ins = simple('ins');

const img: SpanParser = elemProj({
    name: 'img',
    expectedAttrs: {
        src: src => src !== undefined,
    },
    keepWhitespaces: 'both',
    project: el => ({
        interm: 'img',
        attrs: el.attributes,
        content: [] as IntermSpan[],
    }),
});
const a: SpanParser = elemChProj({
    name: 'a',
    keepWhitespaces: 'both',
    children: spans,
    project: (children, el) => ({
        interm: 'a',
        attrs: el.attributes,
        content: children,
    }),
});
const spanSpan: SpanParser = elemChProj({
    name: 'span',
    keepWhitespaces: 'both',
    children: spans,
    onChildrenTail: 'break',
    project: (children, el) => ({
        interm: 'span',
        attrs: el.attributes,
        content: children,
    }),
});
const br: SpanParser = elemProj({
    name: 'br',
    keepWhitespaces: 'leading',
    project: (el): IntermSpan => ({
        interm: 'text',
        attrs: el.attributes,
        content: '\n',
    }),
});

span.implementation = choice(
    text, italic, bold, small, big, sub, sup,
    a, img, spanSpan, ins, quote, br,
);

function simple(name: IntermSpanName, tags?: string[]): SpanParser {
    return elemChProj({
        name: tags || name,
        keepWhitespaces: 'both',
        children: spans,
        project: (children, el): IntermSpan => ({
            interm: name,
            attrs: el.attributes,
            content: children,
        }),
    });
}
