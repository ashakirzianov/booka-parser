import { BookContentNode, filterUndefined, makePph, compoundSpan } from 'booka-common';
import { EpubBookParserHooks, MetadataRecordParser } from './epubBookParser';
import {
    textNode, xmlChildren, extractText, nameEq, xmlNameAttrs,
    xmlNameAttrsChildren, xmlAttributes, xmlNameChildren,
    ignoreClass, buildRef, Tree2ElementsParser,
    whitespaced, xmlElementParser, xmlName, paragraphNode, stream2string,
} from '../xmlTreeParser';
import {
    some, translate, choice, seq, and, headParser, envParser, reject, yieldLast, expectEoi, expectParseAll,
} from '../combinators';
import { BookElement } from '../bookElementParser';
import { XmlTree, isElementTree, tree2String } from '../xmlStringParser';

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

function poem(): Tree2ElementsParser {
    const content = expectParseAll(some(paragraphNode), stream2string);
    const stanza = xmlNameAttrsChildren('div', { class: 'stanza' }, content);

    return translate(
        xmlNameAttrsChildren('div', { class: 'poem' }, whitespaced(choice(stanza, content))),
        pphs => [{
            element: 'content',
            content: {
                node: 'group',
                nodes: pphs,
                semantic: 'poem',
            },
        }],
    );
}

function footnoteSection(): Tree2ElementsParser {
    return envParser(env => {
        const divId = translate(
            xmlNameAttrs('div', { class: 'section2', id: id => id !== undefined }),
            el => el.attributes.id!,
        );
        const h = xmlNameChildren(n => n.startsWith('h'), textNode());
        const title = xmlNameAttrsChildren(
            'div',
            { class: 'note_section' },
            some(whitespaced(h)),
        );
        const back = translate(
            xmlNameAttrs('a', { class: 'note_anchor', href: null }),
            () => undefined,
        );
        const pph = xmlElementParser(
            'p',
            { class: null },
            seq(some(env.spanParser), expectEoi('footnote-p')),
            ([_, [spans]]) => yieldLast(makePph(compoundSpan(spans))),
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
        (x: XmlTree) => yieldLast({ element: 'ignore' } as BookElement),
    );

    const parser = xmlNameAttrsChildren(
        null,
        { class: 'titlepage' },
        some(choice(bookTitle, bookAuthor, ignore)),
    );

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
    const h = whitespaced(xmlNameChildren(n => n.startsWith('h'), textNode()));
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
