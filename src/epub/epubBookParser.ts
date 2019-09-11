import { Book, KnownTag, RawBookNode } from 'booka-common';
import { AsyncIter, equalsToOneOf } from '../utils';
import {
    makeStream, AsyncParser, success, StreamParser, ParserDiagnostic,
    compoundDiagnostic,
} from '../combinators';
import { rawNodesParser } from '../rawNodesParser';
import { EpubBook, EpubKind } from './epubBook';
import { sectionsParser } from './sectionParser';
import { metadataParser } from './metaParser';
import { EpubNodeParser } from './epubNodeParser';

export type EpubBookParserInput = {
    epub: EpubBook,
    options: {
        [key in EpubKind]: EpubConverterHooks;
    },
};

export type MetadataRecordParser = StreamParser<[string, any], KnownTag[]>;
export type EpubConverterHooks = {
    nodeHooks: EpubNodeParser[],
    metadataHooks: MetadataRecordParser[],
};

export type EpubBookParser<R = Book> = AsyncParser<EpubBookParserInput, R>;

export const epubBookParser: EpubBookParser = async input => {
    const { epub, options } = input;
    const diags: ParserDiagnostic[] = [];
    if (epub.kind === 'unknown') {
        diags.push({ custom: 'unknown-kind' });
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
        resolveImageRef: epub.imageResolver,
    }));

    if (!rawNodeResult.success) {
        return rawNodeResult;
    }
    diags.push(rawNodeResult.diagnostic);
    const volume = rawNodeResult.value;
    const book: Book = {
        volume,
        source: {
            source: 'epub',
            kind: epub.kind,
        },
        tags: tags,
    };

    return success(book, input, compoundDiagnostic(diags));
};

function buildMetaNodesFromTags(tags: KnownTag[]): RawBookNode[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const nodes = filtered.map(t => ({
        node: 'tag',
        tag: t,
    } as const));
    return nodes;
}
