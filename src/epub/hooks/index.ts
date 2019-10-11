import { Hooks } from '../../xml2nodes';
import { EpubBook } from '../epubFileParser';
import { HooksProvider, resolveHooksWithProviders } from './hooks';
import { gutenberg } from './gutenberg';
import { fb2epub } from './fb2epub';
import { fictionBookEditor } from './fictionBookEditor';

export function resolveHooks(epub: EpubBook): Hooks | undefined {
    const providers: HooksProvider[] = [
        gutenberg, fb2epub, fictionBookEditor,
    ];
    return resolveHooksWithProviders(epub, providers);
}
