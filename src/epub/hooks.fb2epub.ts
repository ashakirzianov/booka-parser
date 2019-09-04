import { KnownTag } from 'booka-common';
import {
    EpubConverterHooks, MetadataRecord,
} from './epubConverter.types';
import {
    nameChildren, textNode, nameAttrsChildren, some,
    translate, headNode, nameAttrs, choice,
    seq, children, and, whitespaced, name, attrs,
    attrsChildren, extractText, isElement, nameEq,
} from '../xml';
import { Block } from '../bookBlocks';
import { forceType, flatten } from '../utils';
import { NodeHandler, parserHook, ignoreClass } from './nodeHandler';
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

function footnoteSection(): NodeHandler {
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
            () => [{ block: 'ignore' as const }]
        );
        const rec = headNode(env.node2blocks);

        const parser = translate(
            and(
                divId,
                children(seq(title, some(choice(back, rec)))),
            ),
            ([id, [tls, bs]]) => [forceType<Block>({
                block: 'footnote-candidate',
                id: `${env.filePath}#${id}` || 'no-id', // TODO: report missing id
                title: tls || [], // TODO: report missing title
                content: {
                    block: 'container',
                    content: flatten(bs),
                },
            })],
        );

        return parser;
    });
}

function titlePage(): NodeHandler {
    return parserHook(() => {
        const bookTitle = translate(
            extractText(attrs({ class: 'title1' })),
            t => forceType<Block>({
                block: 'book-title',
                title: t,
            }),
        );
        const bookAuthor = translate(
            extractText(attrs({ class: 'title_authors' })),
            a => forceType<Block>({
                block: 'book-author',
                author: a,
            }),
        );
        const ignore = headNode(() => forceType<Block>({ block: 'ignore' }));

        const parser = attrsChildren(
            { class: 'titlepage' },
            some(choice(bookTitle, bookAuthor, ignore)),
        );

        return parser;
    });
}

function divTitle(): NodeHandler {
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
            ([level, ts]) => [forceType<Block>({
                block: 'chapter-title',
                title: ts,
                level: 4 - level,
            })],
        );

        return parser;
    });
}
