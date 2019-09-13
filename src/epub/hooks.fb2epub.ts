import {
    EpubBookParserHooks, MetadataRecordParser, EpubElementParser,
} from './epubBookParser';
import {
    textNode, xmlChildren, whitespaced, extractText,
    nameEq, xmlNameAttrs, xmlNameAttrsChildren, xmlAttributes, xmlNameChildren,
} from '../xmlTreeParser';
import {
    some, translate, choice, seq, and, headParser, envParser, reject, yieldLast,
} from '../combinators';
import { filterUndefined } from '../utils';
import { ignoreClass, buildRef } from './sectionParser.utils';
import { BookElement } from '../bookElementParser';
import { BookContentNode } from 'booka-common';
import { XmlTree, isElementTree } from '../xmlStringParser';

export const fb2epubHooks: EpubBookParserHooks = {
    nodeHooks: [
        ignoreClass('about'),
        ignoreClass('annotation'),
        ignoreClass('coverpage'),
        ignoreClass('fb2_info'),
        divTitle(),
        footnoteSection(),
        titlePage(),
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

function footnoteSection(): EpubElementParser {
    return envParser(env => {
        const divId = translate(
            xmlNameAttrs('div', { class: 'section2', id: id => id !== undefined }),
            el => el.attributes.id!,
        );
        const h = whitespaced(xmlNameChildren(n => n.startsWith('h'), textNode()));
        const title = whitespaced(xmlNameAttrsChildren(
            'div',
            { class: 'note_section' },
            some(h),
        ));
        const back = translate(
            xmlNameAttrs('a', { class: 'note_anchor' }),
            () => undefined,
        );
        const content = translate(
            some(choice(back, env.span)),
            (spans): BookContentNode[] => {
                const defined = filterUndefined(spans);
                return [{
                    node: 'paragraph',
                    span: {
                        span: 'compound',
                        spans: defined,
                    },
                }];
            }
        );

        const parser = translate(
            and(
                divId,
                xmlChildren(seq(title, content)),
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

function titlePage(): EpubElementParser {
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

function divTitle(): EpubElementParser {
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
