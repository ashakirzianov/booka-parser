import { KnownTag, extractSpanText, ParagraphNode } from 'booka-common';
import {
    reject, headParser, yieldLast, translate, choice, expectParseAll, some,
} from '../combinators';
import { isTextTree, isElementTree, XmlTreeWithChildren } from '../xmlStringParser';
import { EpubBookParserHooks, MetadataRecordParser } from './epubBookParser';
import {
    Tree2ElementsParser, span, paragraphNode, stream2string, elemChProj,
} from '../xmlTreeParser';
import { BookElement } from '../bookElementParser';

export const fictionBookEditorHooks: EpubBookParserHooks = {
    nodeHooks: [
        subtitle(),
        titleElement(),
        cite(),
        epigraph(),
    ],
    metadataHooks: [metaHook()],
};

function metaHook(): MetadataRecordParser {
    return headParser(([key, value]) => {
        switch (key) {
            case 'FB2.book-info.translator':
                return yieldLast([{ tag: 'translator', value }]);
            case 'FB2.publish-info.book-name':
                return yieldLast([{ tag: 'title', value }]);
            case 'FB2.publish-info.city':
                return yieldLast([{ tag: 'publish-city', value }]);
            case 'FB2.publish-info.year':
                const year = parseInt(value, 10);
                if (!year) {
                    return {
                        success: true,
                        value: [],
                        diagnostic: {
                            diag: 'bad-meta',
                            meta: { key, value },
                        },
                    };
                } else {
                    return yieldLast([{ tag: 'publish-year', value: year }]);
                }
            case 'FB2EPUB.conversionDate':
            case 'FB2EPUB.version':
            case 'FB2.book-info.date':
            case 'FB2.document-info.date':
            case 'FB2.document-info.program-used':
            case 'FB2.document-info.src-url':
            case 'FB2.document-info.src-ocr':
            case 'FB2.document-info.history':
            case 'FB2.document-info.version':
            case 'FB2.document-info.id':
                return yieldLast([] as KnownTag[]);
            default:
                return reject();
        }
    });
}

function epigraph(): Tree2ElementsParser {
    const content = expectParseAll(some(paragraphNode), stream2string);

    return elemChProj({
        name: 'div',
        requiredAttributes: { class: 'epigraph' },
        children: content,
    },
        ({ children }) => [{
            element: 'content',
            content: {
                node: 'group',
                nodes: children,
                semantic: 'epigraph',
                signature: [],
            },
        }]
    );
}

function cite(): Tree2ElementsParser {
    const textAuthor = elemChProj({
        name: ['div', 'p'],
        requiredAttributes: { class: 'text-author' },
        children: span,
    },
        ({ children }) => ({
            kind: 'signature' as const,
            line: extractSpanText(children),
        }),
    );
    const p = translate(
        paragraphNode,
        pn => ({
            kind: 'pph' as const,
            paragraph: pn,
        }),
    );
    const content = expectParseAll(some(choice(textAuthor, p)), stream2string);

    return elemChProj({
        name: 'div',
        requiredAttributes: { class: 'cite' },
        children: content,
    },
        ({ children }) => {
            const pphs = children.reduce(
                (ps, c) =>
                    c.kind === 'pph' ? ps.concat(c.paragraph) : ps,
                [] as ParagraphNode[],
            );
            const signature = children.reduce(
                (ss, c) =>
                    c.kind === 'signature'
                        ? ss.concat(c.line)
                        : ss,
                [] as string[],
            );

            const result: BookElement = {
                element: 'content',
                content: {
                    node: 'group',
                    nodes: pphs,
                    semantic: 'quote',
                    signature: signature,
                },
            };

            return [result];
        });
}

function subtitle(): Tree2ElementsParser {
    return elemChProj({
        name: 'p',
        requiredAttributes: { class: 'subtitle' },
        children: span,
    },
        ({ children }) => [{
            element: 'chapter-title',
            title: [extractSpanText(children)],
            level: undefined,
        }],
    );
}

function titleElement(): Tree2ElementsParser {
    function extractTextLines(node: XmlTreeWithChildren): string[] {
        const result: string[] = [];
        for (const ch of node.children) {
            if (isElementTree(ch)) {
                result.push(...extractTextLines(ch));
            } else if (isTextTree(ch)) {
                if (!ch.text.startsWith('\n')) {
                    result.push(ch.text);
                }
            }
        }

        return result;
    }

    return headParser(el => {
        if (!isElementTree(el) || el.name !== 'div') {
            return reject();
        }

        const className = el.attributes.class;
        if (className && className.startsWith('title')) {
            const levelStr = className === 'title'
                ? '0'
                : className.substr('title'.length);
            const level = parseInt(levelStr, 10);
            if (!isNaN(level)) {
                const title = extractTextLines(el);
                if (title) {
                    return yieldLast([{
                        element: 'chapter-title',
                        level: 1 - level,
                        title,
                    }]);
                }
            }
        }

        return reject();
    });
}
