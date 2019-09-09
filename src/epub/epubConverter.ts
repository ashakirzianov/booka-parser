import { Book, KnownTag, RawBookNode } from 'booka-common';
import { AsyncIter, equalsToOneOf } from '../utils';
import { rawNodesParser } from '../buildVolume';
import { diagnoser } from '../log';
import { EpubBook } from './epubBook';
import { EpubConverterParameters, EpubConverter, EpubConverterResult } from './epubConverter.types';
import { sectionsParser } from './sectionParser';
import { parseMeta } from './metaParser';
import { makeStream } from '../combinators';

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
        const sectionsParserResult = sectionsParser(makeStream(sections, {
            hooks: hooks.nodeHooks,
            ds: ds,
        }));
        const rawNodes = sectionsParserResult.value;
        const metaNodes = buildMetaNodesFromTags(tags);
        const allNodes = rawNodes.concat(metaNodes);

        const rawNodeResult = await rawNodesParser(makeStream(allNodes, {
            ds, resolveImageRef: epub.imageResolver,
        }));

        if (!rawNodeResult.success) {
            return {
                success: false,
                diagnostics: ds.all(),
            };
        }
        const volume = rawNodeResult.value;
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
