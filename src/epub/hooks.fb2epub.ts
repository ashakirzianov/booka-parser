import {
    BookContentNode, filterUndefined, makePph, compoundSpan,
    extractSpanText,
} from 'booka-common';
import { EpubBookParserHooks, MetadataRecordParser } from './epubBookParser';
import {
    textNode, ignoreClass, buildRef, Tree2ElementsParser,
    whitespaced, paragraphNode, span, elemChProj, elemCh, elemProj, xmlChildren, whitespaces,
} from '../xmlTreeParser';
import {
    some, translate, seq, and, headParser, reject, yieldLast, choice, envParser,
} from '../combinators';
import { BookElement } from '../bookElementParser';
import { XmlTree, tree2String } from '../xmlStringParser';
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
    return elemChProj({
        name: 'p',
        classes: 'subtitle',
        children: span,
        project: children => [{
            element: 'chapter-title',
            level: undefined,
            title: [extractSpanText(children)],
        }],
    });
}

function epigraph(): Tree2ElementsParser {
    const signature = whitespaced(elemCh({
        name: 'p',
        children: span,
    }));
    const signatureDiv = elemCh({
        name: 'div',
        classes: 'epigraph_author',
        children: signature,
    });
    const content = seq(
        whitespaced(paragraphNode),
        whitespaced(signatureDiv),
    );

    return elemChProj({
        name: 'div',
        classes: 'epigraph',
        children: content,
        project: ([pph, sig]) => [{
            element: 'content',
            content: {
                node: 'group',
                nodes: [pph],
                semantic: {
                    epigraph: {
                        signature: [extractSpanText(sig)],
                    },
                },
            },
        }],
    });
}

function poem(): Tree2ElementsParser {
    const content = some(paragraphNode);
    const stanza = elemCh({
        name: 'div',
        classes: 'stanza',
        children: content,
    });
    const children = whitespaced(choice(stanza, content));

    return elemChProj(
        {
            name: 'div',
            classes: 'poem',
            children: children,
            project: ch => [{
                element: 'content',
                content: {
                    node: 'group',
                    nodes: ch,
                    semantic: { poem: {} },
                },
            }],
        });
}

function footnoteSection(): Tree2ElementsParser {
    return envParser(env => {
        const h = elemCh({
            name: n => n ? n.match(/^h[0-9]+$/) !== null : false,
            children: textNode(),
        });
        const title = elemCh({
            name: 'div',
            classes: 'note_section',
            children: some(whitespaced(h)),
        });
        const back = elemProj({
            name: 'a',
            classes: 'note_anchor',
            attrs: { href: null },
            onChildrenTail: 'ignore',
            project: () => undefined,
        });
        const br = elemProj({
            name: 'br',
            project: () => undefined,
        });

        const ignoreAndReport = headParser((el: XmlTree) =>
            yieldLast(undefined, {
                diag: 'unexpected-node',
                context: 'fb2epub-footnote',
                xml: tree2String(el),
            }),
        );
        const pphChildren = choice(br, back, env.paragraphParser, ignoreAndReport);
        const content = translate(
            some(pphChildren),
            (pNodes): BookContentNode[] => {
                const defined = filterUndefined(pNodes);
                return defined;
            }
        );

        const footnoteChildren = seq(whitespaced(title), content);
        return elemChProj({
            context: 'fb2epub footnote',
            name: 'div',
            classes: 'section2',
            attrs: {
                id: id => id !== undefined,
            },
            children: footnoteChildren,
            project: ([tls, footnoteContent], el) => {
                const id = el.attributes.id!;
                const ref = buildRef(env.filePath, id);
                const node: BookElement = {
                    element: 'content',
                    content: {
                        node: 'group',
                        nodes: footnoteContent,
                        refId: ref,
                        semantic: {
                            footnote: {
                                title: tls || [],
                            },
                        },
                    },
                };
                return [node];
            },
        });
    });
}

function titlePage(): Tree2ElementsParser {
    const bookTitle = elemChProj({
        classes: 'title1',
        children: textNode(),
        project: (children: string) => ({
            element: 'tag',
            tag: { tag: 'title', value: children },
        } as const),
    });
    const bookAuthor = elemChProj({
        classes: 'title_authors',
        children: textNode(),
        project: (children: string) => ({
            element: 'tag',
            tag: { tag: 'author', value: children },
        } as const),
    });
    const ignore = headParser(
        (x: XmlTree) =>
            equalsToOneOf(x.name, [undefined, 'br', 'h2', 'h3'])
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

    const parser = elemCh({
        context: 'fb2epub title page',
        name: 'div',
        classes: 'titlepage',
        children: some(choice(bookTitle, bookAuthor, ignore, report)),
    });

    return parser;
}

function divTitle(): Tree2ElementsParser {
    const divLevel = headParser((n: XmlTree) => {
        if (n.type === 'element' && n.name === 'div'
            && n.attributes.class && n.attributes.class.startsWith('title')) {
            const levelString = n.attributes.class.slice('title'.length);
            const level = parseInt(levelString, 10);

            return isNaN(level)
                ? reject()
                : yieldLast(level);
        }

        return reject();
    });
    const h = whitespaced(elemCh({
        name: n => n ? n.startsWith('h') : false,
        children: textNode(),
    }));
    const content = some(h);

    const parser = translate(
        and(divLevel, xmlChildren(content)),
        ([level, ts]) => [{
            element: 'chapter-title' as const,
            title: ts,
            level: 4 - level,
        }],
    );

    return parser;
}
