import { KnownTag, extractSpanText, ParagraphNode } from 'booka-common';
import {
    reject, headParser, yieldLast, translate, choice, some,
} from '../combinators';
import { XmlTreeWithChildren } from '../xmlStringParser';
import { EpubBookParserHooks, MetadataRecordParser } from './epubBookParser';
import {
    Tree2ElementsParser, span, elemChProj, spans,
} from '../xmlTreeParser';
import { BookElement } from '../bookElementParser';

export const fictionBookEditorHooks: EpubBookParserHooks = {
    nodeHooks: [
        subtitle(),
        titleElement(),
        // cite(),
        // epigraph(),
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

// function epigraph(): Tree2ElementsParser {
//     const content = null as any; // some(paragraphNode);

//     return elemChProj({
//         name: 'div',
//         classes: 'epigraph',
//         children: content,
//         project: children => [{
//             element: 'content',
//             content: {
//                 node: 'group',
//                 nodes: children,
//                 semantic: {
//                     epigraph: {
//                         signature: [],
//                     },
//                 },
//             },
//         }],
//     });
// }

// function cite(): Tree2ElementsParser {
//     const textAuthor = elemChProj({
//         name: ['div', 'p'],
//         classes: 'text-author',
//         children: spans,
//         project: children => ({
//             kind: 'signature' as const,
//             line: extractSpanText(children),
//         }),
//     });
//     const p = translate(
//         paragraphNode,
//         pn => ({
//             kind: 'pph' as const,
//             paragraph: pn,
//         }),
//     );
//     const content = some(choice(textAuthor, p));

//     return elemChProj({
//         name: 'div',
//         classes: 'cite',
//         children: content,
//         project: children => {
//             const pphs = children.reduce(
//                 (ps, c) =>
//                     c.kind === 'pph' ? ps.concat(c.paragraph) : ps,
//                 [] as ParagraphNode[],
//             );
//             const signature = children.reduce(
//                 (ss, c) =>
//                     c.kind === 'signature'
//                         ? ss.concat(c.line)
//                         : ss,
//                 [] as string[],
//             );

//             const result: BookElement = {
//                 element: 'content',
//                 content: {
//                     node: 'group',
//                     nodes: pphs,
//                     semantic: {
//                         quote: {
//                             signature: signature,
//                         },
//                     },
//                 },
//             };

//             return [result];
//         },
//     });
// }

function subtitle(): Tree2ElementsParser {
    return elemChProj({
        name: 'p',
        classes: 'subtitle',
        children: span,
        project: children => [{
            element: 'chapter-title',
            title: [extractSpanText(children)],
            level: undefined,
        }],
    });
}

function titleElement(): Tree2ElementsParser {
    function extractTextLines(node: XmlTreeWithChildren): string[] {
        const result: string[] = [];
        for (const ch of node.children) {
            if (ch.type === 'element') {
                result.push(...extractTextLines(ch));
            } else if (ch.type === 'text') {
                if (!ch.text.startsWith('\n')) {
                    result.push(ch.text);
                }
            }
        }

        return result;
    }

    return headParser(el => {
        if (el.type !== 'element' || el.name !== 'div') {
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
