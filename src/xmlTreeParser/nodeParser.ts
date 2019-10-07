import {
    yieldLast, headParser, choice, oneOrMore, translate,
    ParserDiagnostic, some, seq, projectLast, declare,
} from '../combinators';
import { elemCh, elemChProj, elemProj, TreeParser, TreeStream } from './treeParser';
import { spans, span } from './spanParser';
import { tree2String } from '../xmlStringParser';
import {
    IntermListItem, IntermTableCell, IntermTableRow, IntermTop, IntermPph,
} from '../intermediate';
import { flatten } from 'booka-common';

export const moreClasses = [
    // TODO: do not ignore ?
    'letterdate', 'letter1', 'titlepage', 'footer', 'intro',
    'poem', 'poem1', 'gapspace', 'gapshortline', 'noindent',
    'figcenter', 'stanza', 'foot', 'letter', 'gutindent', 'poetry',
    'finis', 'verse', 'gutsumm', 'pfirst', 'right', 'state', 'book',
    'contents', 'preface1', 'preface2',
    'extracts', 'mynote', 'letterdate', 'letter1', 'titlepage',
    'contents', 'centered', 'poem', 'figcenter', 'blockquot',
    'stanza', 'book', 'title', 'title2',
    // TODO: handle properly !!!
    'footnote', 'toc',
];

export const node = declare<TreeStream, IntermTop>();
const nodes = some(node);

const wrappedPph: TreeParser<IntermPph> = elemChProj({
    context: 'wrappedSpans',
    name: ['p', 'span', 'div'],
    children: spans,
    onChildrenTail: 'break',
    project: (content, { attributes }) => ({
        interm: 'pph',
        attrs: attributes,
        content,
    }),
});
const plainPph: TreeParser<IntermPph> = translate(
    oneOrMore(span),
    content => ({
        interm: 'pph',
        attrs: {},
        content,
    }),
);
const pph = choice(wrappedPph, plainPph);
const pphs = some(pph);

const li: TreeParser<IntermListItem> = elemChProj({
    name: 'li',
    children: spans,
    project: (content, { attributes }) => ({
        interm: 'item',
        attrs: attributes,
        content,
    }),
});
const lis = some(li);
const list: TreeParser<IntermTop> = elemChProj({
    context: 'list',
    name: ['ol', 'ul'],
    children: lis,
    project: (content, element) => ({
        interm: 'list',
        attrs: element.attributes,
        kind: element.name === 'ol' ? 'ordered' : 'unordered',
        content,
    }),
});

const td: TreeParser<IntermTableCell> = elemChProj({
    context: 'table cell',
    name: ['td', 'th'],
    children: pphs,
    project: (content, { attributes }) => {
        return {
            interm: 'cell',
            attrs: attributes,
            content: flatten(content.map(p => p.content)),
        };
    },
});
const tds = some(td);

const tr: TreeParser<IntermTableRow> = elemChProj({
    context: 'table row',
    name: 'tr',
    children: tds,
    project: (content, { attributes }) => {
        return {
            interm: 'row',
            attrs: attributes,
            content,
        };
    },
});

// TODO: do not ignore ?
const tableIgnore = elemProj({
    name: ['colgroup', 'col'],
    project: () => undefined,
});
const tbodyTag = elemCh({
    name: 'tbody',
    children: some(tr),
});
const tbody = projectLast(
    seq(some(tableIgnore), tbodyTag),
);
const tableContent = choice(tbody, some(tr));
const table: TreeParser<IntermTop> = elemChProj({
    name: 'table',
    children: tableContent,
    project: (content, xml) => {
        return {
            interm: 'table',
            attrs: xml.attributes,
            content,
        };
    },
});

const hr: TreeParser<IntermTop> = elemProj({
    context: 'separator',
    name: 'hr',
    project: ({ attributes }) => {
        return {
            interm: 'separator',
            attrs: attributes,
        };
    },
});

const container: TreeParser<IntermTop> = elemChProj({
    context: 'container',
    name: ['p', 'div', 'span', 'blockquote', 'a'],
    children: nodes,
    project: (content, { attributes }) => {
        return {
            interm: 'container',
            attrs: attributes,
            content,
        };
    },
});

const img: TreeParser<IntermTop> = elemProj({
    name: 'img',
    expectedAttrs: {
        src: src => src ? true : false,
    },
    project: ({ attributes }) => {
        return {
            interm: 'image',
            attrs: attributes,
        };
    },
});

const image: TreeParser<IntermTop> = elemProj({
    name: 'img',
    expectedAttrs: {
        'xlink:href': href => href ? true : false,
    },
    onChildrenTail: 'ignore',
    project: ({ attributes }) => {
        return {
            interm: 'image',
            attrs: attributes,
        };
    },
});

const header: TreeParser<IntermTop> = elemChProj({
    name: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    children: spans,
    project: (content, { name, attributes }) => {
        const level = parseInt(name[1], 10);
        return {
            interm: 'header',
            attrs: attributes,
            level: isNaN(level) ? 0 : 4 - level,
            content,
        };
    },
});

const ignore: TreeParser<IntermTop> = elemProj({
    context: 'ignore',
    name: ['svg'],
    onChildrenTail: 'ignore',
    project: ({ attributes }) => {
        return {
            interm: 'ignore',
            attrs: attributes,
        };
    },
});

const skip: TreeParser<IntermTop> = headParser(xml => {
    const diag: ParserDiagnostic = {
        diag: 'unexpected-node',
        xml: tree2String(xml, 1),
    };
    return yieldLast({
        interm: 'ignore',
        attrs: xml.type === 'element'
            ? xml.attributes
            : {},
    }, diag);
});

node.implementation = choice(
    pph, header, img, image, hr,
    list, table, container,
    ignore, skip,
);
