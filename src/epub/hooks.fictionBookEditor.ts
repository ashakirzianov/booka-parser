import { KnownTag } from 'booka-common';
import { fail, success, headParser } from '../combinators';
import { isTextTree, isElementTree, XmlTreeWithChildren } from '../xmlParser';
import { EpubConverterHooks, MetadataRecordParser, EpubNodeParser } from './epubBookParser';

export const fictionBookEditorHooks: EpubConverterHooks = {
    nodeHooks: [
        titleElement(),
    ],
    metadataHooks: [metaHook()],
};

function metaHook(): MetadataRecordParser {
    return headParser(([key, value]) => {
        switch (key) {
            case 'FB2.book-info.translator':
                return success([{ tag: 'translator', value }]);
            case 'FB2.publish-info.book-name':
                return success([{ tag: 'title', value }]);
            case 'FB2.publish-info.city':
                return success([{ tag: 'publish-city', value }]);
            case 'FB2.publish-info.year':
                const year = parseInt(value, 10);
                if (!year) {
                    return {
                        success: true,
                        value: [],
                        diagnostic: {
                            custom: 'bad-meta',
                            meta: { key, value },
                        },
                    };
                } else {
                    return success([{ tag: 'publish-year', value: year }]);
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
                return success<any, any>([]);
            default:
                return fail();
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
            return fail();
        }

        const className = el.attributes.class;
        if (className && className.startsWith('title')) {
            const levelStr = className === 'title'
                ? '0'
                : className.substr('title'.length);
            const level = parseInt(levelStr, 10);
            // TODO: add diagnostics here ?
            if (!isNaN(level)) {
                const title = extractTextLines(el);
                if (title) {
                    return success([{
                        node: 'chapter-title',
                        level: 1 - level,
                        title,
                    }]);
                }
            }
        }

        return fail();
    });
}
