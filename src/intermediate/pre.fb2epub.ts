import { ProcResolver, IntermProcessor } from './intermParser';
import { reject } from '../combinators';

const fb2EpubPrep: IntermProcessor = () => reject();

export const fb2epub: ProcResolver = ({ rawMetadata }) => {
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
        ? fb2EpubPrep
        : undefined;
};
