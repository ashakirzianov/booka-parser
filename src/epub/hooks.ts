import { Hooks } from '../xml2nodes';
import { EpubBook } from './epubFileParser';

export type HooksProvider = (epub: EpubBook) => Hooks | undefined;

export function resolveHooks(epub: EpubBook, providers: HooksProvider[]): Hooks | undefined {
    for (const p of providers) {
        const hooks = p(epub);
        if (hooks !== undefined) {
            return hooks;
        }
    }
    return undefined;
}
