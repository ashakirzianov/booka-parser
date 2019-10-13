import { HooksProvider, Hooks } from './hooks';

export const fictionBookEditor: HooksProvider = epub => {
    const marker = epub.metadata['FB2.document-info.program-used'];
    const isMarked = marker !== undefined
        && typeof marker === 'string'
        && marker.startsWith('FictionBook Editor');
    return isMarked
        ? fictionBookEditorHooks
        : undefined;
};

const fictionBookEditorHooks: Hooks = {
    xml: {},
};
