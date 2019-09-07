import { Book, KnownTag, RawBookNode } from 'booka-common';
import { EpubBook } from './epubParser.types';
import {
    AsyncIter, flatten, equalsToOneOf,
} from '../utils';
import { buildVolume } from '../buildVolume';
import { EpubConverterParameters, EpubConverter, EpubConverterResult, MetadataHook, MetadataRecord } from './epubConverter.types';
import { ParserDiagnoser, diagnoser } from '../log';
import { parseSections } from './sectionParser';

export function createConverter(params: EpubConverterParameters): EpubConverter {
    return {
        convertEpub: epub => convertEpub(epub, params),
    };
}

async function convertEpub(epub: EpubBook, params: EpubConverterParameters): Promise<EpubConverterResult> {
    const ds = diagnoser({ context: 'epub', kind: epub.kind });
    try {
        if (epub.kind === 'unknown') {
            ds.add({ diag: 'unknown-kind' });
        }

        const hooks = params.options[epub.kind];
        const sections = await AsyncIter.toArray(epub.sections());
        const rawNodes = parseSections(sections, hooks.nodeHooks, ds);
        const tags = buildMetaTags(epub, hooks.metadataHooks, ds);
        const metaNodes = buildMetaNodes(tags);
        const allNodes = rawNodes.concat(metaNodes);

        const volume = await buildVolume(allNodes, {
            ds,
            resolveImageRef: epub.imageResolver,
        });
        const book: Book = {
            volume,
            source: {
                source: 'epub',
                kind: epub.kind,
            },
            tags: tags,
        };

        return {
            success: true,
            book: book,
            kind: epub.kind,
            diagnostics: ds.all(),
        };
    } catch {
        return {
            success: false,
            diagnostics: ds.all(),
        };
    }
}

function buildMetaNodes(tags: KnownTag[]): RawBookNode[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const nodes = filtered.map(t => ({
        node: 'tag',
        tag: t,
    } as const));
    return nodes;
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

function buildMetaTags(epub: EpubBook, metadataHooks: MetadataHook[], ds: ParserDiagnoser): KnownTag[] {
    const allHooks = metadataHooks.concat(defaultMetadataHook);
    const result: KnownTag[] = [];
    for (const [key, value] of Object.entries(epub.metadata)) {
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
    const result: KnownTag[] = [];
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
