import { KnownTag } from 'booka-common';
import { reject, headParser, yieldLast } from '../combinators';
import { isTextTree, isElementTree, XmlTreeWithChildren } from '../xmlParser';
import { EpubBookParserHooks, MetadataRecordParser, EpubNodeParser } from './epubBookParser';

export const fictionBookEditorHooks: EpubBookParserHooks = {
    nodeHooks: [
        titleElement(),
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

function titleElement(): EpubNodeParser {
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
