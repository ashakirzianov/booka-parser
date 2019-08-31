import { EpubConverterOptionsTable } from './epubConverter.types';
import { fictionBookEditorHooks } from './hooks.fictionBookEditor';
import { fb2epubHooks } from './hooks.fb2epub';
import { gutenbergHooks } from './hooks.gutenberg';

export const converterHooks: EpubConverterOptionsTable = {
    fb2epub: fb2epubHooks,
    fictionBookEditor: fictionBookEditorHooks,
    gutenberg: gutenbergHooks,
    unknown: {
        nodeHooks: [],
        metadataHooks: [],
    },
};
