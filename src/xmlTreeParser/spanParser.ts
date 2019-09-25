import { Span, compoundSpan, AttributeName } from 'booka-common';
import {
    declare, translate, seq, some, endOfInput, choice,
    headParser, yieldLast, reject, Stream, expectEoi, projectFirst,
} from '../combinators';
import { xmlElementChildrenProj } from './treeParser';
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

const brSpan: Tree2SpanParser = xmlElementChildrenProj({
    name: 'br',
    children: expectEoi(stream2string),
},
    () => '\n',
);

const correctionSpan: Tree2SpanParser = xmlElementChildrenProj({
    name: 'ins',
    expectedAttributes: { title: null },
    children: expectSpanContent,
},
    ({ element: xml, children: content }) => ({
        span: 'compound',
        spans: [content],
        semantic: 'correction',
        note: xml.attributes.title,
    }),
);

const spanSpan: Tree2SpanParser = xmlElementChildrenProj({
    name: 'span',
    expectedAttributes: {
        id: null,
        class: null, href: null, title: null, tag: null,
    },
    children: spanContent,
},
    ({ children }) => compoundSpan(children),
);
const aSpan: Tree2SpanParser = xmlElementChildrenProj({
    name: 'a',
    expectedAttributes: {
        id: null,
        class: null, href: null, title: null, tag: null,
    },
    children: spanContent,
},
    ({ element, children }) => {
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
);

span.implementation = choice(
    text, attr, brSpan,
    correctionSpan, aSpan, spanSpan,
);

function attrsSpanParser(tagNames: string[], attrs: AttributeName[], contentParser: Tree2SpanParser): Tree2SpanParser {
    return xmlElementChildrenProj({
        name: tagNames,
        expectedAttributes: { class: null, id: null },
        children: contentParser,
    },
        ({ children }) => ({
            span: 'attrs',
            attrs,
            content: children,
        }),
    );
}
