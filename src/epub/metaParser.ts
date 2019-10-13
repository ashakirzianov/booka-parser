import { KnownTag, buildTagSet } from 'booka-common';
import {
    yieldLast, SuccessLast, ParserDiagnostic, compoundDiagnostic, ResultLast,
} from '../combinators';
import { EpubBook } from './epubFileParser';

export type MetadataRecordHook = (name: string, value: any) => ResultLast<KnownTag[]>;
export function metadataParser(epub: EpubBook, hook: MetadataRecordHook | undefined): SuccessLast<KnownTag[]> {
    const records = Object
        .entries(epub.metadata);
    const diags: ParserDiagnostic[] = [];
    const tags: KnownTag[] = [];
    for (const [name, value] of records) {
        if (hook) {
            const hookResult = hook(name, value);
            diags.push(hookResult.diagnostic);
            if (hookResult.success) {
                tags.push(...hookResult.value);
                continue;
            }
        }
        const result = defaultMetadata(name, value);
        diags.push(result.diagnostic);
        tags.push(...result.value);
    }
    const unique = buildTagSet(tags);
    return yieldLast(unique, compoundDiagnostic(diags));
}

function defaultMetadata(name: string, value: any): SuccessLast<KnownTag[]> {
    switch (name) {
        case 'title':
            return yieldLast([{ tag: 'title', value }]);
        case 'creator':
            return yieldLast([{ tag: 'author', value }]);
        case 'cover':
            return yieldLast([{ tag: 'cover-ref', value }]);
        case 'subject':
            return yieldLast([{ tag: 'subject', value }]);
        case 'language':
            return yieldLast([{ tag: 'language', value }]);
        case 'publisher':
            return yieldLast([{ tag: 'publisher', value }]);
        case 'description':
            return yieldLast([{ tag: 'description', value }]);
        case 'series':
            return yieldLast([{ tag: 'series', value }]);
        case 'ISBN':
            return yieldLast([{ tag: 'ISBN', value }]);
        case 'dc:rights':
            return yieldLast([{ tag: 'rights', value }]);
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return yieldLast([] as KnownTag[]);
        default:
            return yieldLast([] as KnownTag[], {
                diag: 'unexpected metadata',
                name, value,
            });
    }
}
