import { BookContentNode, filterUndefined, makePph, compoundSpan, extractSpanText, extractNodeText } from 'booka-common';
import { EpubBookParserHooks, MetadataRecordParser } from './epubBookParser';
import {
    textNode, extractText, nameEq,
    ignoreClass, buildRef, Tree2ElementsParser,
    whitespaced, xmlName, paragraphNode, stream2string, span, xmlChildren, xmlAttributes, xmlElementChProj, xmlElementCh, xmlElementProj,
} from '../xmlTreeParser';
import {
    some, translate, choice, seq, and, headParser, envParser, reject, yieldLast, expectEoi, expectParseAll,
} from '../combinators';
import { BookElement } from '../bookElementParser';
import { XmlTree, isElementTree, tree2String } from '../xmlStringParser';
import { equalsToOneOf } from '../utils';

export const fb2epubHooks: EpubBookParserHooks = {
    nodeHooks: [
        ignoreClass('about'),
        ignoreClass('annotation'),
        ignoreClass('coverpage'),
        ignoreClass('fb2_info'),
        divTitle(),
        footnoteSection(),
        titlePage(),
        poem(),
        epigraph(),
        subtitle(),
    ],
    metadataHooks: [metaHook()],
};

function metaHook(): MetadataRecordParser {
    return headParser(([key, value]) => {
        switch (key) {
            case 'calibre:timestamp':
            case 'calibre:title_sort':
            case 'calibre:series':
            case 'calibre:series_index':
                return yieldLast([]);
            default:
                return reject();
        }
    });
}

function subtitle(): Tree2ElementsParser {
    return xmlElementChProj({
        name: 'p',
        requiredAttributes: { class: 'subtitle' },
        children: span,
    },
        ({ children }) => [{
            element: 'chapter-title',
            level: undefined,
            title: [extractSpanText(children)],
        }],
    );
}

function epigraph(): Tree2ElementsParser {
    const signature = whitespaced(xmlElementCh({
        name: 'p',
        children: span,
    }));
    const signatureDiv = xmlElementCh({
        name: 'div',
        requiredAttributes: { class: 'epigraph_author' },
        children: signature,
    });
    const content = seq(
        whitespaced(paragraphNode),
        whitespaced(signatureDiv),
    );

    return xmlElementChProj({
        name: 'div',
        requiredAttributes: { class: 'epigraph' },
        children: content,
    },
        ({ children: [pph, sig] }) => [{
            element: 'content',
            content: {
                node: 'group',
                nodes: [pph],
                semantic: 'epigraph',
                signature: [extractSpanText(sig)],
            },
        }],
    );
}

function poem(): Tree2ElementsParser {
    const content = expectParseAll(some(paragraphNode), stream2string);
    const stanza = xmlElementCh({
        name: 'div',
        requiredAttributes: { class: 'stanza' },
        children: content,
    });

    return xmlElementChProj(
        {
            name: 'div',
            requiredAttributes: { class: 'poem' },
            children: whitespaced(choice(stanza, content)),
        },
        ({ children }) => [{
            element: 'content',
            content: {
                node: 'group',
                nodes: children,
                semantic: 'poem',
            },
        }],
    );
}

function footnoteSection(): Tree2ElementsParser {
    return envParser(env => {
        const divId = xmlElementProj({
            name: 'div',
            requiredAttributes: {
                class: 'section2',
                id: id => id !== undefined,
            },
        },
            ({ element }) => element.attributes.id!,
        );
        const h = xmlElementCh({
            name: n => n.match(/^h[0-9]+$/) !== null,
            children: textNode(),
        });
        const title = xmlElementCh({
            name: 'div',
            requiredAttributes: { class: 'note_section' },
            children: some(whitespaced(h)),
        });
        const back = xmlElementProj({
            name: 'a',
            requiredAttributes: { class: 'note_anchor', href: null },
        },
            () => undefined,
        );
        const pph = xmlElementChProj({
            name: 'p',
            expectedAttributes: { class: null },
            children: seq(some(env.spanParser), expectEoi('footnote-p')),
        },
            ({ children: [spans] }) => makePph(compoundSpan(spans)),
        );
        const br = translate(
            xmlName('br'),
            () => undefined,
        );
        const skipWhitespaces = translate(
            textNode(),
            () => undefined,
        );
        const ignoreAndReport = headParser((el: XmlTree) =>
            yieldLast(undefined, {
                diag: 'unexpected-node',
                context: 'fb2epub-footnote',
                xml: tree2String(el),
            }),
        );
        const contentNode = choice(skipWhitespaces, back, br, pph, ignoreAndReport);
        const content = translate(
            some(contentNode),
            (pNodes): BookContentNode[] => {
                const defined = filterUndefined(pNodes);
                return defined;
            }
        );

        const parser = translate(
            and(
                divId,
                xmlChildren(seq(whitespaced(title), content)),
            ),
            ([id, [tls, footnoteContent]]) => {
                const ref = buildRef(env.filePath, id);
                const node: BookElement = {
                    element: 'content',
                    content: {
                        node: 'group',
                        nodes: footnoteContent,
                        refId: ref,
                        semantic: 'footnote',
                        title: tls || [],
                    },
                };
                return [node];
            },
        );

        return parser;
    });
}

function titlePage(): Tree2ElementsParser {
    const bookTitle = translate(
        extractText(xmlAttributes({ class: 'title1' })),
        t => ({
            element: 'tag',
            tag: { tag: 'title', value: t },
        } as BookElement),
    );
    const bookAuthor = translate(
        extractText(xmlAttributes({ class: 'title_authors' })),
        a => ({
            element: 'tag',
            tag: { tag: 'author', value: a },
        } as BookElement),
    );
    const ignore = headParser(
        (x: XmlTree) =>
            equalsToOneOf(x.name, [undefined, 'br', 'h3'])
                ? yieldLast({ element: 'ignore' as const })
                : reject(),
    );
    const report = headParser(
        (x: XmlTree) => yieldLast(
            { element: 'ignore' as const },
            {
                diag: 'unexpected-node',
                xml: tree2String(x),
                context: 'titlepage',
            },
        ),
    );

    const parser = xmlElementCh({
        name: null,
        requiredAttributes: { class: 'titlepage' },
        children: some(choice(bookTitle, bookAuthor, ignore, report)),
    });

    return parser;
}

function divTitle(): Tree2ElementsParser {
    const divLevel = headParser((n: XmlTree) => {
        if (isElementTree(n) && nameEq('div', n.name)
            && n.attributes.class && n.attributes.class.startsWith('title')) {
            const levelString = n.attributes.class.slice('title'.length);
            const level = parseInt(levelString, 10);

            return isNaN(level)
                ? reject()
                : yieldLast(level);
        }

        return reject();
    });
    const h = whitespaced(xmlElementCh({
        name: n => n.startsWith('h'),
        children: textNode(),
    }));
    const content = some(h);

    const parser = translate(
        and(divLevel, xmlChildren(content)),
        ([level, ts]) => [{
            element: 'chapter-title',
            title: ts,
            level: 4 - level,
        } as BookElement],
    );

    return parser;
}
