import { Span, compoundSpan, AttributeName } from 'booka-common';
import {
    declare, translate, seq, some, endOfInput, choice,
    headParser, yieldLast, reject, Stream, expectEoi, projectFirst,
} from '../combinators';
import { xmlElementParser } from './treeParser';
import { XmlTree, tree2String } from '../xmlStringParser';
import { TreeParserEnv, Tree2SpanParser, stream2string } from './utils';

export const span = declare<Stream<XmlTree, TreeParserEnv>, Span>('span');

export const spanContent = projectFirst(seq(some(span), endOfInput(stream2string)));
export const expectSpanContent: Tree2SpanParser = translate(
    some(choice(span, headParser(
        el =>
            yieldLast('', { diag: 'unexpected-xml', xml: tree2String(el) })
    ))),
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

const brSpan: Tree2SpanParser = xmlElementParser(
    'br', {}, expectEoi(stream2string),
    () => yieldLast('\n'),
);

const correctionSpan: Tree2SpanParser = xmlElementParser(
    'ins',
    { title: null },
    expectSpanContent,
    ([xml, content]) => yieldLast({
        span: 'compound',
        spans: [content],
        semantic: 'correction',
        note: xml.attributes.title,
    }),
);

const spanSpan: Tree2SpanParser = xmlElementParser(
    'span',
    {
        id: null,
        class: null, href: null, title: null, tag: null,
    },
    spanContent,
    ([xml, sp]) => yieldLast(compoundSpan(sp)),
);
const aSpan: Tree2SpanParser = xmlElementParser(
    'a',
    {
        id: null,
        class: null, href: null, title: null, tag: null,
    },
    spanContent,
    ([xml, sp]) => {
        const content = compoundSpan(sp);
        if (xml.attributes.href !== undefined) {
            return yieldLast({
                span: 'ref',
                refToId: xml.attributes.href,
                content,
            });
        } else {
            return yieldLast(content);
        }
    });

span.implementation = choice(
    text, attr, brSpan,
    correctionSpan, aSpan, spanSpan,
);

function attrsSpanParser(tagNames: string[], attrs: AttributeName[], contentParser: Tree2SpanParser): Tree2SpanParser {
    return xmlElementParser(
        tagNames,
        { class: null, id: null },
        contentParser,
        ([_, content]) => yieldLast({
            span: 'attrs',
            attrs,
            content,
        }));
}
