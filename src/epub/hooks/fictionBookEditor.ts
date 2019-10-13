import { HooksProvider } from './hooks';
import { XmlHooks } from '../../xml2nodes';

export const fictionBookEditor: HooksProvider = epub => {
    const marker = epub.metadata['FB2.document-info.program-used'];
    const isMarked = marker !== undefined
        && typeof marker === 'string'
        && marker.startsWith('FictionBook Editor');
    return isMarked
        ? fictionBookEditorHooks
        : undefined;
};

const fictionBookEditorHooks: XmlHooks = {};
