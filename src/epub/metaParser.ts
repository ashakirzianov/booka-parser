import { KnownTag } from 'booka-common';
import { EpubMetadata } from './epubBook';
import { flatten } from '../utils';
import { MetadataHook, MetadataRecord } from './epubConverter';
import { ParserDiagnoser } from '../log';

export function parseMeta(meta: EpubMetadata, hooks: MetadataHook[], ds: ParserDiagnoser): KnownTag[] {
    const tags = buildMetaTags(meta, hooks, ds);

    return tags;
}

function defaultMetadataHook({ key, value }: MetadataRecord): KnownTag[] | undefined {
    switch (key) {
        case 'title':
            return [{ tag: 'title', value }];
        case 'creator':
            return [{ tag: 'author', value }];
        case 'cover':
            return [{ tag: 'cover-ref', value }];
        case 'subject':
            return [{ tag: 'subject', value }];
        case 'language':
            return [{ tag: 'language', value }];
        case 'publisher':
            return [{ tag: 'publisher', value }];
        case 'description':
            return [{ tag: 'description', value }];
        case 'series':
            return [{ tag: 'series', value }];
        case 'ISBN':
            return [{ tag: 'ISBN', value }];
        case 'dc:rights':
            return [{ tag: 'rights', value }];
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return [];
        default:
            return undefined;
    }
}

function buildMetaTags(meta: EpubMetadata, metadataHooks: MetadataHook[], ds: ParserDiagnoser): KnownTag[] {
    const allHooks = metadataHooks.concat(defaultMetadataHook);
    const result: KnownTag[] = [];
    for (const [key, value] of Object.entries(meta)) {
        if (Array.isArray(value)) {
            const tags = flatten(
                value.map(v => buildMetaTagsForRecord(key, v, allHooks, ds))
            );
            result.push(...tags);
        } else if (value) {
            const tags = buildMetaTagsForRecord(key, value, allHooks, ds);
            result.push(...tags);
        }
    }

    return result;
}

function buildMetaTagsForRecord(key: string, value: string, allHooks: MetadataHook[], ds: ParserDiagnoser): KnownTag[] {
    const record = { key, value };
    const tags = allHooks.reduce<KnownTag[] | undefined>(
        (res, hook) => res || hook(record, ds),
        undefined,
    );
    if (!tags) {
        ds.add({ diag: 'unknown-meta', key, value });
        return [];
    } else {
        return tags;
    }
}
