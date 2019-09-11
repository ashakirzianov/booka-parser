import { Book, KnownTag, RawBookNode } from 'booka-common';
import { AsyncIter, equalsToOneOf } from '../utils';
import { ParserDiagnostic, ParserDiagnoser, diagnoser } from '../log';
import { makeStream, AsyncParser, success, fail, StreamParser } from '../combinators';
import { rawNodesParser } from '../rawNodesParser';
import { EpubBook, EpubKind } from './epubBook';
import { sectionsParser } from './sectionParser';
import { metadataParser } from './metaParser';
import { EpubNodeParser } from './epubNodeParser';

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
export type MetadataRecordParser = StreamParser<MetadataRecord, KnownTag[]>;
export type EpubConverterHooks = {
    nodeHooks: EpubNodeParser[],
    metadataHooks: MetadataRecordParser[],
};

export type EpubBookParser<R = EpubBookParserResult> = AsyncParser<EpubBookParserInput, R>;

export const epubBookParser: EpubBookParser = async input => {
    const { epub, options } = input;
    const ds = diagnoser({ context: 'epub', kind: epub.kind });
    if (epub.kind === 'unknown') {
        ds.add({ diag: 'unknown-kind' });
    }

    const hooks = options[epub.kind];
    const metadataResult = await metadataParser(input);
    const tags = metadataResult.success ? metadataResult.value : [];
    const sections = await AsyncIter.toArray(epub.sections());
    const sectionsParserResult = sectionsParser(makeStream(sections, {
        hooks: hooks.nodeHooks,
    }));
    const rawNodes = sectionsParserResult.value;
    const metaNodes = buildMetaNodesFromTags(tags);
    const allNodes = rawNodes.concat(metaNodes);

    const rawNodeResult = await rawNodesParser(makeStream(allNodes, {
        ds, resolveImageRef: epub.imageResolver,
    }));

    if (!rawNodeResult.success) {
        return fail({ custom: 'custom', diags: ds.all(), inside: rawNodeResult.diagnostic });
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
};

function buildMetaNodesFromTags(tags: KnownTag[]): RawBookNode[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const nodes = filtered.map(t => ({
        node: 'tag',
        tag: t,
    } as const));
    return nodes;
}
