import { EpubBookParserInput } from './epubBookParser';
import { fictionBookEditorHooks } from './hooks.fictionBookEditor';
import { fb2epubHooks } from './hooks.fb2epub';
import { gutenbergHooks } from './hooks.gutenberg';

export const epubParserHooks: EpubBookParserInput['options'] = {
    fb2epub: fb2epubHooks,
    fictionBookEditor: fictionBookEditorHooks,
    gutenberg: gutenbergHooks,
    unknown: {
        nodeHooks: [],
        metadataHooks: [],
    },
};
