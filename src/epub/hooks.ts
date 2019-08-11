import { EpubConverterOptionsTable } from './epubConverter';
import { fictionBookEditorHooks } from './hooks.fictionBookEditor';
import { fb2epubHooks } from './hooks.fb2epub';

export const converterHooks: EpubConverterOptionsTable = {
    fb2epub: fb2epubHooks,
    fictionBookEditor: fictionBookEditorHooks,
    unknown: {
        nodeHooks: [],
    },
};
