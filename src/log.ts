import { Node } from 'booka-common';
import { XmlNode, XmlNodeElement } from './xml';
import { MetadataRecord } from './epub/epubConverter.types';
import { EpubKind } from './epub/epubParser.types';

export function diagnoser(context: ParserContext): ParserDiagnoser {
    return new ParserDiagnoser(context);
}

export class ParserDiagnoser {
    public readonly diags: ParserDiagnostic[] = [];

    constructor(readonly context: ParserContext) { }

    public add(diag: ParserDiagnostic) {
        this.diags.push(diag);
    }

    public all() {
        return this.diags;
    }
}

export type ParserContext =
    | Context<'epub'> & { title?: string }
    ;

type Context<K extends string> = { context: K, kind?: EpubKind };

export type ParserDiagnostic =
    | XmlDiag<'img-must-have-src'>
    | XmlDiag<'image-must-have-xlinkhref'>
    | XmlDiag<'link-must-have-ref'>
    | XmlDiag<'unexpected-node'>
    | XmlDiag<'no-title'>
    | Diag<'unexpected-attr'> & { name: string, value: string | undefined, element: XmlNodeElement, constraint: string }
    | Diag<'empty-book-title'>
    | Diag<'extra-nodes-tail'> & { nodes: any[] }
    | Diag<'unexpected-raw-node'> & { node: Node }
    | Diag<'couldnt-build-span'> & { node: Node, context: 'attr' | 'footnote' }
    | Diag<'unexpected-title'> & { node: Node }
    | Diag<'couldnt-resolve-ref'> & { id: string }
    | Diag<'unknown-kind'>
    | Diag<'unknown-meta'> & { key: string, value: any }
    | Diag<'bad-meta'> & { meta: MetadataRecord }
    | Diag<'failed-to-parse'> & { trees: XmlNode[] }
    ;

type Diag<K extends string> = {
    diag: K,
    context?: string,
};
type XmlDiag<K extends string> = Diag<K> & { node: XmlNode };

export type LogLevel = 'info' | 'important' | 'warn';

export type Logger = {
    [k in LogLevel]: (message: string) => void;
};

export function logger(): Logger {
    return {
        warn: () => undefined,
        info: () => undefined,
        important: () => undefined,
    };
}
