import {
    EpubConverterHooks, MetadataRecordParser, EpubNodeParser,
} from './epubBookParser';
import {
    textNode, xmlChildren, whitespaced, extractText, isElementTree,
    nameEq, XmlTree, xmlNameAttrs, xmlNameAttrsChildren, xmlAttributes, xmlNameChildren,
} from '../xmlParser';
import {
    some, translate, choice, seq, and, headParser, envParser, reject, yieldLast,
} from '../combinators';
import { flatten } from '../utils';
import { ignoreClass, buildRef } from './sectionParser.utils';
import { BookElement, IgnoreElement } from '../bookElementParser';

export const fb2epubHooks: EpubConverterHooks = {
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

function footnoteSection(): EpubNodeParser {
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
            () => [{ node: 'ignore' } as IgnoreElement]
        );
        const rec = env.recursive;

        const parser = translate(
            and(
                divId,
                xmlChildren(seq(title, some(choice(back, rec)))),
            ),
            ([id, [tls, bs]]) => {
                const ref = buildRef(env.filePath, id);
                const node: BookElement = {
                    node: 'compound-raw',
                    refId: ref,
                    semantic: 'footnote',
                    title: tls || [],
                    nodes: flatten(bs),
                };
                return [node];
            },
        );

        return parser;
    });
}

function titlePage(): EpubNodeParser {
    const bookTitle = translate(
        extractText(xmlAttributes({ class: 'title1' })),
        t => ({
            node: 'tag',
            tag: { tag: 'title', value: t },
        } as BookElement),
    );
    const bookAuthor = translate(
        extractText(xmlAttributes({ class: 'title_authors' })),
        a => ({
            node: 'tag',
            tag: { tag: 'author', value: a },
        } as BookElement),
    );
    const ignore = headParser(
        (x: XmlTree) => yieldLast({ node: 'ignore' } as BookElement),
    );

    const parser = xmlNameAttrsChildren(
        null,
        { class: 'titlepage' },
        some(choice(bookTitle, bookAuthor, ignore)),
    );

    return parser;
}

function divTitle(): EpubNodeParser {
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
            node: 'chapter-title',
            title: ts,
            level: 4 - level,
        } as BookElement],
    );

    return parser;
}
