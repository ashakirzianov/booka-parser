import { KnownTag, RawBookNode, IgnoreNode } from 'booka-common';
import {
    EpubConverterHooks, MetadataRecord,
} from './epubConverter.types';
import {
    nameChildren, textNode, nameAttrsChildren,
    nameAttrs, children, whitespaced, attrs,
    attrsChildren, extractText, isElementTree, nameEq, XmlTree,
} from '../xmlParser';
import {
    some, translate, choice, seq, and, headParser, envParser,
} from '../combinators';
import { flatten } from '../utils';
import { ignoreClass, EpubNodeParser, buildRef } from './nodeParser';
import { ParserDiagnoser } from '../log';

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
    metadataHooks: [metaHook],
};

function metaHook({ key, value }: MetadataRecord, ds: ParserDiagnoser): KnownTag[] | undefined {
    switch (key) {
        case 'calibre:timestamp':
        case 'calibre:title_sort':
        case 'calibre:series':
        case 'calibre:series_index':
            return [];
        default:
            return undefined;
    }
}

function footnoteSection(): EpubNodeParser {
    return envParser(env => {
        const divId = translate(
            nameAttrs('div', { class: 'section2', id: id => id !== undefined }),
            el => el.attributes.id,
        );
        const h = whitespaced(nameChildren(n => n.startsWith('h'), textNode()));
        const title = whitespaced(nameAttrsChildren(
            'div',
            { class: 'note_section' },
            some(h),
        ));
        const back = translate(
            nameAttrs('a', { class: 'note_anchor' }),
            () => [{ node: 'ignore' } as IgnoreNode]
        );
        const rec = env.recursive;

        const parser = translate(
            and(
                divId,
                children(seq(title, some(choice(back, rec)))),
            ),
            ([id, [tls, bs]]) => {
                const ref = id && buildRef(env.filePath, id); // TODO: report missing id
                return [{
                    node: 'compound-raw',
                    ref: ref,
                    // title: tls || [], // TODO: use title
                    nodes: flatten(bs),
                } as RawBookNode];
            },
        );

        return parser;
    });
}

function titlePage(): EpubNodeParser {
    const bookTitle = translate(
        extractText(attrs({ class: 'title1' })),
        t => ({
            node: 'tag',
            tag: { tag: 'title', value: t },
        } as RawBookNode),
    );
    const bookAuthor = translate(
        extractText(attrs({ class: 'title_authors' })),
        a => ({
            node: 'tag',
            tag: { tag: 'author', value: a },
        } as RawBookNode),
    );
    const ignore = headParser(
        (x: XmlTree) => ({ node: 'ignore' } as RawBookNode),
    );

    const parser = attrsChildren(
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
                ? null
                : level;
        }

        return null;
    });
    const h = whitespaced(nameChildren(n => n.startsWith('h'), textNode()));
    const content = some(h);

    const parser = translate(
        and(divLevel, children(content)),
        ([level, ts]) => [{
            node: 'chapter-title',
            title: ts,
            level: 4 - level,
        } as RawBookNode],
    );

    return parser;
}
