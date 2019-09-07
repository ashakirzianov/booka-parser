import { KnownTag } from 'booka-common';
import { isTextTree, isElementTree, XmlTreeWithChildren } from '../xml';
import { ParserDiagnoser } from '../log';
import { EpubConverterHooks, MetadataRecord } from './epubConverter.types';
import { headNode } from './nodeParser';

export const fictionBookEditorHooks: EpubConverterHooks = {
    nodeHooks: [
        titleElement(),
    ],
    metadataHooks: [metaHook],
};

function metaHook({ key, value }: MetadataRecord, ds: ParserDiagnoser): KnownTag[] | undefined {
    switch (key) {
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
            return [];
        case 'FB2.book-info.translator':
            return [{ tag: 'translator', value }];
        case 'FB2.publish-info.book-name':
            return [{ tag: 'title', value }];
        case 'FB2.publish-info.city':
            return [{ tag: 'publish-city', value }];
        case 'FB2.publish-info.year':
            const year = parseInt(value, 10);
            if (!year) {
                ds.add({ diag: 'bad-meta', meta: { key, value } });
            } else {
                return [{ tag: 'publish-year', value: year }];
            }
        default:
            return undefined;
    }
}

function titleElement() {
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

    return headNode(el => {
        if (!isElementTree(el) || el.name !== 'div') {
            return null;
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
                    return [{
                        node: 'chapter-title',
                        level: 1 - level,
                        title,
                    }];
                }
            }
        }

        return null;
    });
}
