import { Book, KnownTag } from 'booka-common';
import { ParserDiagnostic, ParserDiagnoser } from '../log';
import { EpubBook, EpubKind, EpubMetadata } from './epubParser.types';
import { NodeHandler } from './nodeHandler';

export type EpubConverterResult = {
    success: true,
    book: Book,
    kind: EpubKind,
    diagnostics: ParserDiagnostic[],
} | {
    success: false,
    diagnostics: ParserDiagnostic[],
};
export type EpubConverter = {
    convertEpub: (epub: EpubBook) => Promise<EpubConverterResult>,
};

export type EpubConverterParameters = {
    options: EpubConverterOptionsTable,
};

export type EpubConverterOptionsTable = {
    [key in EpubKind]: EpubConverterHooks;
};

export type MetadataRecord = {
    key: string,
    value: any,
};
export type MetadataHook = (meta: MetadataRecord, ds: ParserDiagnoser) => KnownTag[] | undefined;
export type EpubConverterHooks = {
    nodeHooks: NodeHandler[],
    metadataHooks: MetadataHook[],
};
