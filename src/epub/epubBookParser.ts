import { Book, KnownTag, RawBookNode } from 'booka-common';
import { AsyncIter, equalsToOneOf } from '../utils';
import { ParserDiagnostic, ParserDiagnoser, diagnoser } from '../log';
import { makeStream, AsyncParser, success, fail } from '../combinators';
import { rawNodesParser } from '../rawNodesParser';
import { EpubBook, EpubKind } from './epubBook';
import { sectionsParser } from './sectionParser';
import { parseMeta } from './metaParser';
import { EpubNodeParser } from './nodeParser';

export type EpubBookParserResult = {
    book: Book,
    diagnostics: ParserDiagnostic[],
};
export type EpubBookParserInput = {
    epub: EpubBook,
    options: EpubBookParserOptionsTable,
};
// TODO: remove ?
export type EpubBookParserOptionsTable = {
    [key in EpubKind]: EpubConverterHooks;
};

export type MetadataRecord = {
    key: string,
    value: any,
};
export type MetadataHook = (meta: MetadataRecord, ds: ParserDiagnoser) => KnownTag[] | undefined;
export type EpubConverterHooks = {
    nodeHooks: EpubNodeParser[],
    metadataHooks: MetadataHook[],
};

export type EpubBookParser = AsyncParser<EpubBookParserInput, EpubBookParserResult>;

export const epubBookParser: EpubBookParser = async input => {
    const { epub, options } = input;
    const ds = diagnoser({ context: 'epub', kind: epub.kind });
    try {
        if (epub.kind === 'unknown') {
            ds.add({ diag: 'unknown-kind' });
        }

        const hooks = options[epub.kind];
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
            return fail({ diag: 'custom', diags: ds.all() });
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

        return success({
            book: book,
            diagnostics: ds.all(),
        }, input);
    } catch {
        return fail({ diag: 'custom', diags: ds.all() });
    }
};

function buildMetaNodesFromTags(tags: KnownTag[]): RawBookNode[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const nodes = filtered.map(t => ({
        node: 'tag',
        tag: t,
    } as const));
    return nodes;
}
