import {
    KnownTag, buildTagSet,
    success, Success, Diagnostic, compoundDiagnostic, Result,
} from 'booka-common';
import { EpubBook } from './epubFileParser';

export type MetadataRecordHook = (name: string, value: any) => Result<KnownTag[]>;
export function metadataParser(epub: EpubBook, hook: MetadataRecordHook | undefined): Success<KnownTag[]> {
    const records = Object
        .entries(epub.metadata);
    const diags: Diagnostic[] = [];
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
    return success(unique, compoundDiagnostic(diags));
}

function defaultMetadata(name: string, value: any): Success<KnownTag[]> {
    switch (name) {
        case 'title':
            return success([{ tag: 'title', value }]);
        case 'creator':
            return success([{ tag: 'author', value }]);
        case 'cover':
            return value
                ? success([{ tag: 'cover-ref', value }])
                : success([]);
        case 'subject':
            return success([{ tag: 'subject', value }]);
        case 'language':
            return success([{ tag: 'language', value }]);
        case 'publisher':
            return success([{ tag: 'publisher', value }]);
        case 'description':
            return success([{ tag: 'description', value }]);
        case 'series':
            return success([{ tag: 'series', value }]);
        case 'ISBN':
            return success([{ tag: 'ISBN', value }]);
        case 'dc:rights':
            return success([{ tag: 'rights', value }]);
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return success([] as KnownTag[]);
        default:
            return success([] as KnownTag[], {
                diag: 'unexpected metadata',
                name, value,
            });
    }
}
