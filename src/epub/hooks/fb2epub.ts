import { HooksProvider, Hooks } from './hooks';
import { MetadataRecordHook } from '../metaParser';
import { success, failure } from '../../combinators';

export const fb2epub: HooksProvider = ({ rawMetadata }) => {
    if (!rawMetadata) {
        return undefined;
    }

    const contributor = rawMetadata['dc:contributor'];
    if (!contributor || !Array.isArray(contributor)) {
        return undefined;
    }

    const fb2epubMarker = contributor
        .map(i => i['#'])
        .find(i => typeof i === 'string' && i.startsWith('Fb2epub'));

    return fb2epubMarker !== undefined
        ? fb2epubHooks
        : undefined;
};

const metadata: MetadataRecordHook = (key, value) => {
    switch (key) {
        case 'calibre:timestamp':
        case 'calibre:title_sort':
        case 'calibre:series':
        case 'calibre:series_index':
            return success([]);
        default:
            return failure();
    }
};

const fb2epubHooks: Hooks = {
    xml: {},
    metadata,
};
