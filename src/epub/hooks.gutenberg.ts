import { EpubBookParserHooks, MetadataRecordParser } from './epubBookParser';
import {
    textNode,
    whitespaces, buildRef, Tree2ElementsParser, ignoreClass, elemProj, elem, elemChProj, elemCh,
} from '../xmlTreeParser';
import {
    and, translate, seq, maybe, envParser, headParser, reject, yieldLast, some,
} from '../combinators';
import { ParagraphNode, makePph, KnownTag, flatten } from 'booka-common';

export const gutenbergHooks: EpubBookParserHooks = {
    nodeHooks: [
        footnote(),
        skipTocP(),
        skipTocTable(),
        ignoreClass('chapterhead'),
        referenceBookMarker(),
        oldFashionTitle(),
    ],
    metadataHooks: [metaHook()],
};

function metaHook(): MetadataRecordParser {
    return headParser(([key, value]) => {
        switch (key) {
            case 'subject':
                const subs = value as string[];
                const subjects = flatten(subs.map(sub => sub.split(' -- ')));
                const tags: KnownTag[] = subjects.map(sub => ({
                    tag: 'subject' as const,
                    value: sub,
                }));
                return yieldLast(tags);
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

function oldFashionTitle(): Tree2ElementsParser {
    const titleRegex = /\*\*\*\*\*The Project Gutenberg Etext "([^"\*]*)\**"/;
    return elemChProj({
        name: 'p',
        attrs: {
            style: 'margin-top: 2em',
        },
        children: textNode(text => {
            const match = text.match(titleRegex);
            return match ? match[1] : null;
        }),
        project: (title: string) => {
            return [{
                element: 'tag',
                tag: {
                    tag: 'title',
                    value: title,
                },
            }];
        },
    });
}

function referenceBookMarker(): Tree2ElementsParser {
    const markerText = `THIS EBOOK WAS ONE OF PROJECT GUTENBERG'S EARLY FILES`;
    return elemChProj({
        name: 'p',
        children: textNode(text =>
            text.startsWith(markerText)
                ? true
                : null),
        project: () => {
            return [{
                element: 'tag',
                tag: {
                    tag: 'pg-skip',
                },
            }];
        },
    });
}

function skipTocP(): Tree2ElementsParser {
    return elemProj({
        name: 'p',
        classes: 'toc',
        project: () => [],
    });
}

function skipTocTable(): Tree2ElementsParser {
    return elemProj({
        name: 'table',
        attrs: { summary: 'Toc' },
        project: () => [],
    });
}

function footnote(): Tree2ElementsParser {
    return envParser(env => {
        const footnoteId = elemProj({
            name: 'a',
            attrs: {
                id: i => i
                    ? i.startsWith('link')
                    : false,
            },
            project: el => el.attributes.id,
        });
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
            classes: 'foot',
            children: footnoteContent,
            project: ([title, content]) => ({ title, content }),
        });

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
