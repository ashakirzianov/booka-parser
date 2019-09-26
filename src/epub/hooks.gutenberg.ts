import { EpubBookParserHooks, MetadataRecordParser } from './epubBookParser';
import {
    textNode,
    whitespaces, buildRef, Tree2ElementsParser, ignoreClass, elemProj, elem, elemChProj, elemCh,
} from '../xmlTreeParser';
import {
    and, translate, seq, maybe, envParser, headParser, reject, yieldLast, some,
} from '../combinators';
import { ParagraphNode, makePph } from 'booka-common';

export const gutenbergHooks: EpubBookParserHooks = {
    nodeHooks: [
        footnote(),
        skipTocP(),
        skipTocTable(),
        ignoreClass('chapterhead'),
    ],
    metadataHooks: [metaHook()],
};

function metaHook(): MetadataRecordParser {
    return headParser(([key, value]) => {
        switch (key) {
            case 'dc:identifier':
                const id = value['#'];
                if (id && typeof id === 'string') {
                    const matches = id.match(/http:\/\/www.gutenberg\.org\/ebooks\/([0-9]*)/);
                    if (matches && matches[1]) {
                        const index = parseInt(matches[1], 10);
                        if (index) {
                            return yieldLast([{ tag: 'pg-index', value: index }]);
                        }
                    }
                }

                return yieldLast([], { diag: 'bad-meta', meta: { key, value } });
            default:
                return reject();
        }
    });
}

function skipTocP(): Tree2ElementsParser {
    return elemProj({
        name: 'p',
        requiredAttributes: { class: 'toc' },
    },
        () => [],
    );
}

function skipTocTable(): Tree2ElementsParser {
    return elemProj({
        name: 'table',
        requiredAttributes: { summary: 'Toc', class: null },
    },
        () => [],
    );
}

function footnote(): Tree2ElementsParser {
    return envParser(env => {
        const footnoteId = elemProj({
            name: 'a',
            requiredAttributes: {
                id: i => i
                    ? i.startsWith('link')
                    : false,
            },
        },
            ({ element }) => element.attributes.id,
        );
        const footnoteMarker = elemCh({
            name: 'p',
            children: footnoteId,
        });

        const footnoteTitle = textNode(t => {
            if (t.endsWith('(')) {
                t = t.substr(0, t.length - 1);
            }

            return t.trim();
        });

        const footnoteTitleLine = translate(
            seq(
                footnoteTitle,
                elem({ name: 'a' }),
                textNode(),
                elem({ name: 'br' }),
            ),
            ([title]) => title,
        );

        const pph = translate(
            some(env.spanParser),
            (spans): ParagraphNode => makePph({
                span: 'compound',
                spans,
            }),
        );
        const footnoteContent = seq(maybe(footnoteTitleLine), pph);
        const footnoteContainer = elemChProj({
            name: 'p',
            requiredAttributes: { class: 'foot' },
            children: footnoteContent,
        },
            ({ children: [title, content] }) => ({ title, content }),
        );

        const fullFootnote: Tree2ElementsParser = translate(
            seq(footnoteMarker, whitespaces, footnoteContainer),
            ([id, _, { content, title }]) => [{
                element: 'content',
                content: {
                    node: 'group',
                    refId: buildRef(env.filePath, id),
                    nodes: [content],
                    semantic: 'footnote',
                    title: title ? [title] : [],
                },
            }],
        );

        return fullFootnote;
    });
}
