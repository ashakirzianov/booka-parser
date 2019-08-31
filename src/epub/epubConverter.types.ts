import { Book } from 'booka-common';
import { ParserDiagnostic } from '../log';
import { EpubBook, EpubKind } from './epubParser.types';
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

export type EpubConverterHooks = {
    nodeHooks: NodeHandler[],
};
