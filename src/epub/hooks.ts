import { EpubBookParserOptionsTable } from './epubBookParser';
import { fictionBookEditorHooks } from './hooks.fictionBookEditor';
import { fb2epubHooks } from './hooks.fb2epub';
import { gutenbergHooks } from './hooks.gutenberg';

export const converterHooks: EpubBookParserOptionsTable = {
    fb2epub: fb2epubHooks,
    fictionBookEditor: fictionBookEditorHooks,
    gutenberg: gutenbergHooks,
    unknown: {
        nodeHooks: [],
        metadataHooks: [],
    },
};
