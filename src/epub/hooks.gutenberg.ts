import { EpubConverterHooks, MetadataRecord } from './epubConverter.types';
import { ignoreTags } from './nodeHandler';
import { ParserDiagnoser } from '../log';

export const gutenbergHooks: EpubConverterHooks = {
    nodeHooks: [
        // TODO: do not ignore?
        ignoreTags(['hr', 'blockquote', 'table', 'br']),
    ],
    metadataHooks: [metaHook],
};

function metaHook(record: MetadataRecord, ds: ParserDiagnoser) {
    switch (record.key) {
        case 'creatorFileAs':
        case 'date':
            return [];
        default:
            return undefined;
    }
}
