import { XmlHooks } from '../../xml2nodes';
import { EpubBook } from '../epubFileParser';
import { MetadataRecordHook } from '../metaParser';

export type Hooks = {
    xml: XmlHooks,
    metadata?: MetadataRecordHook | undefined,
};
export type HooksProvider = (epub: EpubBook) => Hooks | undefined;

export function resolveHooksWithProviders(epub: EpubBook, providers: HooksProvider[]): Hooks | undefined {
    for (const p of providers) {
        const hooks = p(epub);
        if (hooks !== undefined) {
            return hooks;
        }
    }
    return undefined;
}
