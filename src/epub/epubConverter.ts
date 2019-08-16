import { ParserDiagnostic } from '../log';
import { XmlNode } from '../xml';
import { EpubBook, EpubSource, Image } from './epubParser';
import { Block } from '../bookBlocks';
import { VolumeNode } from '../bookFormat';
import { NodeHandler, NodeHandlerEnv } from './nodeHandler';

export type EpubConverterResult = {
    volume: VolumeNode,
    diagnostics: ParserDiagnostic[],
    resolveImage(id: string): Promise<Image | undefined>,
};
export type EpubConverter = {
    convertEpub: (epub: EpubBook) => Promise<EpubConverterResult>,
};

export type EpubConverterParameters = {
    options: EpubConverterOptionsTable,
};

export type EpubConverterOptionsTable = {
    [key in EpubSource]: EpubConverterOptions;
};

export type EpubConverterOptions = {
    nodeHooks: NodeHandler[],
};
