import {
    EpubConverterOptions, element2block, EpubConverterNodeHook,
    parserHook,
} from './epubConverter';
import {
    nameChildren, textNode, nameAttrsChildren, some,
    translate, headNode, nameAttrs, choice,
    seq, children, and, whitespaced, name, attrs, expected, attrsChildren, extractText, isElement, xmlNode2String, nameEq,
} from '../xml';
import { Block } from '../bookBlocks';
import { forceType, flatten } from '../utils';

export const fb2epubHooks: EpubConverterOptions = {
    nodeHooks: [
        ignoreClass('about'),
        ignoreClass('annotation'),
        ignoreClass('coverpage'),
        ignoreClass('fb2_info'),
        divTitle(),
        footnoteSection(),
        titlePage(),
    ],
};

function ignoreClass(className: string) {
    return element2block(el =>
        el.attributes.class === className
            ? { block: 'ignore' }
            : undefined
    );
}

function footnoteSection(): EpubConverterNodeHook {
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

function titlePage(): EpubConverterNodeHook {
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

function divTitle(): EpubConverterNodeHook {
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
