import { ParserDiagnostic } from '../log';
import { EpubBook, EpubSource } from './epubParser.types';
import { VolumeNode } from 'booka-common';
import { NodeHandler } from './nodeHandler';

export type EpubConverterResult = {
    success: true,
    volume: VolumeNode,
    source: EpubSource,
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
    [key in EpubSource]: EpubConverterHooks;
};

export type EpubConverterHooks = {
    nodeHooks: NodeHandler[],
};
