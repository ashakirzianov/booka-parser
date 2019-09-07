import { Book, KnownTag, RawBookNode } from 'booka-common';
import { AsyncIter, equalsToOneOf } from '../utils';
import { buildVolume } from '../buildVolume';
import { diagnoser } from '../log';
import { EpubBook } from './epubParser.types';
import { EpubConverterParameters, EpubConverter, EpubConverterResult } from './epubConverter.types';
import { parseSections } from './sectionParser';
import { parseMeta } from './metaParser';

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
        const tags = parseMeta(epub.metadata, hooks.metadataHooks, ds);
        const sections = await AsyncIter.toArray(epub.sections());
        const rawNodes = parseSections(sections, hooks.nodeHooks, ds);
        const metaNodes = buildMetaNodesFromTags(tags);
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

function buildMetaNodesFromTags(tags: KnownTag[]): RawBookNode[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const nodes = filtered.map(t => ({
        node: 'tag',
        tag: t,
    } as const));
    return nodes;
}
