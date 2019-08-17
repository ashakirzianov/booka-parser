import { XmlNode, XmlNodeElement } from './xml';
import { Block } from './bookBlocks';

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

type Context<K extends string> = { context: K };

export type ParserDiagnostic =
    | NodeDiag<'node-other'> & { message: string }
    | NodeDiag<'img-must-have-src'>
    | NodeDiag<'image-must-have-xlinkhref'>
    | NodeDiag<'link-must-have-ref'>
    | NodeDiag<'unexpected-node'> & { context?: 'title' }
    | Diag<'no-title'> & { nodes: XmlNode[] }
    | Diag<'unexpected-attr'> & { name: string, value: string | undefined, element: XmlNodeElement }
    | Diag<'empty-book-title'>
    | Diag<'extra-blocks-tail'> & { blocks: Block[] }
    | BlockDiag<'unexpected-block'>
    | BlockDiag<'couldnt-build-span'> & { context: 'attr' | 'footnote' }
    | Diag<'couldnt-resolve-ref'> & { id: string }
    | Diag<'unknown-source'>
    ;

type Diag<K extends string> = {
    diag: K,
};
type NodeDiag<K extends string> = Diag<K> & { node: XmlNode };
type BlockDiag<K extends string> = Diag<K> & { block: Block };

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
