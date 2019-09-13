import { Span, compoundSpan, AttributeName } from 'booka-common';
import {
    declare, translate, seq, some, empty, choice,
    headParser, yieldLast, reject, Stream, expectEmpty, projectFirst,
} from '../combinators';
import { XmlTree, xmlElementParser } from '../xmlStringParser';
import { EpubTreeParserEnv, EpubSpanParser } from './epubBookParser';

export const span = declare<Stream<XmlTree, EpubTreeParserEnv>, Span>('span');

export const spanContent = projectFirst(seq(some(span), empty()));
const expectSpanContent: EpubSpanParser = translate(
    some(choice(span, headParser(
        el =>
            yieldLast('', { diag: 'unexpected-xml', tree: el })
    ))),
    compoundSpan,
);

const text: EpubSpanParser = headParser(node => {
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

const brSpan: EpubSpanParser = xmlElementParser(
    'br', {}, expectEmpty,
    () => yieldLast('/n'),
);

const spanSpan: EpubSpanParser = xmlElementParser(
    'span',
    {
        id: null,
        class: null, href: null, title: null, tag: null,
    },
    spanContent,
    ([xml, sp]) => yieldLast(compoundSpan(sp)),
);
const aSpan: EpubSpanParser = xmlElementParser(
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

span.implementation = choice(text, attr, brSpan, aSpan, spanSpan);

function attrsSpanParser(tagNames: string[], attrs: AttributeName[], contentParser: EpubSpanParser): EpubSpanParser {
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
