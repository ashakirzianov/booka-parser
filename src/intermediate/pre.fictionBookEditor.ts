import { PreResolver } from './preprocessor';
import { reject } from '../combinators';

const fictionBookEditorP = () => reject();
export const fictionBookEditorRes: PreResolver = epub => {
    const marker = epub.metadata['FB2.document-info.program-used'];
    const isMarked = marker !== undefined
        && typeof marker === 'string'
        && marker.startsWith('FictionBook Editor');
    return isMarked
        ? fictionBookEditorP
        : undefined;
};
