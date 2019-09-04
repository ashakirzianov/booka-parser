import { EpubConverterHooks, MetadataRecord } from './epubConverter.types';
import { ignoreTags } from './nodeHandler';
import { ParserDiagnoser } from '../log';

export const gutenbergHooks: EpubConverterHooks = {
    nodeHooks: [
        // TODO: do not ignore?
        ignoreTags(['hr', 'blockquote', 'table', 'br']),
    ],
    metadataHooks: [],
};
