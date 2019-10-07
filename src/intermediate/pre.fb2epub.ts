import { PreResolver, IntermPreprocessor } from './preprocessor';
import { reject } from '../combinators';

const fb2EpubP: IntermPreprocessor = () => reject();

export const fb2epubRes: PreResolver = ({ rawMetadata }) => {
    if (!rawMetadata) {
        return undefined;
    }

    const contributor = rawMetadata['dc:contributor'];
    if (!contributor || !Array.isArray(contributor)) {
        return undefined;
    }

    const fb2epub = contributor
        .map(i => i['#'])
        .find(i => typeof i === 'string' && i.startsWith('Fb2epub'));

    return fb2epub !== undefined
        ? fb2EpubP
        : undefined;
};
