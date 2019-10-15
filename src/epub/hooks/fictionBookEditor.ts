import { HooksProvider, Hooks } from './hooks';
import { MetadataRecordHook } from '../metaParser';
import { reject, yieldLast } from '../../combinators';
import { KnownTag } from 'booka-common';

export const fictionBookEditor: HooksProvider = epub => {
    const marker = epub.metadata['FB2.document-info.program-used'];
    const isMarked = marker !== undefined
        && typeof marker === 'string'
        && marker.startsWith('FictionBook Editor');
    return isMarked
        ? fictionBookEditorHooks
        : undefined;
};

const metadata: MetadataRecordHook = (key, value) => {
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
};

const fictionBookEditorHooks: Hooks = {
    xml: {},
    metadata,
};