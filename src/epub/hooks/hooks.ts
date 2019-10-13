import { XmlHooks } from '../../xml2nodes';
import { EpubBook } from '../epubFileParser';

export type HooksProvider = (epub: EpubBook) => XmlHooks | undefined;

export function resolveHooksWithProviders(epub: EpubBook, providers: HooksProvider[]): XmlHooks | undefined {
    for (const p of providers) {
        const hooks = p(epub);
        if (hooks !== undefined) {
            return hooks;
        }
    }
    return undefined;
}
