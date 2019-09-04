import { EpubConverterHooks } from './epubConverter.types';
import { ignoreTags } from './nodeHandler';

export const gutenbergHooks: EpubConverterHooks = {
    nodeHooks: [
        // TODO: do not ignore?
        ignoreTags(['hr', 'blockquote', 'table', 'br']),
    ],
    metadataHooks: [],
};
