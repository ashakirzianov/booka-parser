import { KnownTag, RawBookNode, IgnoreNode } from 'booka-common';
import {
    EpubConverterHooks, MetadataRecord,
} from './epubConverter.types';
import {
    nameChildren, textNode, nameAttrsChildren, some,
    translate, headNode, nameAttrs, choice,
    seq, children, and, whitespaced, name, attrs,
    attrsChildren, extractText, isElement, nameEq,
} from '../xml';
import { forceType, flatten } from '../utils';
import { XmlHandler, parserHook, ignoreClass } from './nodeHandler';
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

function footnoteSection(): XmlHandler {
    return parserHook(env => {
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
            name('a'),
            () => [{ node: 'ignore' } as IgnoreNode]
        );
        const rec = headNode(env.xml2blocks);

        const parser = translate(
            and(
                divId,
                children(seq(title, some(choice(back, rec)))),
            ),
            ([id, [tls, bs]]) => [forceType<RawBookNode>({
                node: 'container',
                ref: `${env.filePath}#${id}` || 'no-id', // TODO: report missing id
                // title: tls || [], // TODO: handle title
                nodes: flatten(bs),
            })],
        );

        return parser;
    });
}

function titlePage(): XmlHandler {
    return parserHook(() => {
        const bookTitle = translate(
            extractText(attrs({ class: 'title1' })),
            t => forceType<RawBookNode>({
                node: 'tag',
                tag: { tag: 'title', value: t },
            }),
        );
        const bookAuthor = translate(
            extractText(attrs({ class: 'title_authors' })),
            a => forceType<RawBookNode>({
                node: 'tag',
                tag: { tag: 'author', value: a },
            }),
        );
        const ignore = headNode(() => forceType<RawBookNode>({ node: 'ignore' }));

        const parser = attrsChildren(
            { class: 'titlepage' },
            some(choice(bookTitle, bookAuthor, ignore)),
        );

        return parser;
    });
}

function divTitle(): XmlHandler {
    return parserHook(() => {
        const divLevel = headNode(n => {
            if (isElement(n) && nameEq('div', n.name)
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
            ([level, ts]) => [forceType<RawBookNode>({
                node: 'title',
                title: ts,
                level: 4 - level,
            })],
        );

        return parser;
    });
}
