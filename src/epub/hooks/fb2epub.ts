import { HooksProvider } from './hooks';
import { XmlHooks } from '../../xml2nodes';

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

const fb2epubHooks: XmlHooks = {};
