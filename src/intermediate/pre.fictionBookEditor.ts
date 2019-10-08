import { ProcResolver } from './intermParser';
import { reject } from '../combinators';

const fictionBookEditorPrep = () => reject();
export const fictionBookEditor: ProcResolver = epub => {
    const marker = epub.metadata['FB2.document-info.program-used'];
    const isMarked = marker !== undefined
        && typeof marker === 'string'
        && marker.startsWith('FictionBook Editor');
    return isMarked
        ? fictionBookEditorPrep
        : undefined;
};
