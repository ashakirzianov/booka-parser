import { WithDiagnostics, ParserDiagnoser } from '../log';
import { XmlNode, XmlNodeElement, isElement, XmlParser } from '../xml';
import { EpubBook, EpubSource } from './epubParser';
import { Block } from '../bookBlocks';
import { VolumeNode } from '../bookFormat';

export type EpubConverter = {
    convertEpub: (epub: EpubBook) => Promise<WithDiagnostics<VolumeNode>>,
};

export type EpubConverterParameters = {
    options: EpubConverterOptionsTable,
};

export type EpubConverterOptionsTable = {
    [key in EpubSource]: EpubConverterOptions;
};

export type EpubConverterOptions = {
    nodeHooks: EpubConverterNodeHook[],
};

export type EpubConverterHookEnv = {
    ds: ParserDiagnoser,
    node2blocks: (x: XmlNode) => Block[],
    filePath: string,
};
export type EpubConverterHookResult = Block[] | undefined;
export type EpubConverterNodeHook = (x: XmlNode, env: EpubConverterHookEnv) => EpubConverterHookResult;

export function element2block(hook: (el: XmlNodeElement, ds: ParserDiagnoser) => (Block | undefined)): EpubConverterNodeHook {
    return (node, env) => {
        if (!isElement(node)) {
            return undefined;
        }

        const result = hook(node, env.ds);
        return result ? [result] : undefined;
    };
}

export function parserHook(buildParser: (env: EpubConverterHookEnv) => XmlParser<Block[]>): EpubConverterNodeHook {
    return (node, env) => {
        const parser = buildParser(env);
        const result = parser([node]);

        return result.success
            ? result.value
            : undefined;
    };
}

export function applyHooks(x: XmlNode, hooks: EpubConverterNodeHook[], env: EpubConverterHookEnv): Block[] | undefined {
    for (const hook of hooks) {
        const hooked = hook(x, env);
        if (hooked) {
            return hooked;
        }
    }

    return undefined;
}
