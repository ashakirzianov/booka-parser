import { fictionBookEditorHooks } from './hooks.fictionBookEditor';
import { fb2epubHooks } from './hooks.fb2epub';
import { gutenbergHooks } from './hooks.gutenberg';
import { EpubKind } from './epubBook';
import { EpubBookParserHooks } from './epubBookParser';

export type AllHooks = {
    [key in EpubKind]: EpubBookParserHooks;
};
export const epubParserHooks: AllHooks = {
    fb2epub: fb2epubHooks,
    fictionBookEditor: fictionBookEditorHooks,
    gutenberg: gutenbergHooks,
    unknown: {
        nodeHooks: [],
        metadataHooks: [],
    },
};
