import { Logger } from './logger';
import { XmlNode, XmlNodeElement, xmlNode2String } from '../xml';
import { assertNever } from '../utils';
import { Block } from '../bookBlocks';

export type WithDiagnostics<T> = {
    value: T,
    diagnostics: ParserDiagnoser,
};

export function diagnoser(context: ParserContext): ParserDiagnoser {
    return new ParserDiagnoser(context);
}

export class ParserDiagnoser {
    private readonly diags: ParserDiagnostic[] = [];

    constructor(readonly context: ParserContext) { }

    public add(diag: ParserDiagnostic) {
        this.diags.push(diag);
    }

    public log(logger: Logger) {
        if (this.diags.length === 0) {
            return;
        }
        this.logContext(logger);
        for (const d of this.diags) {
            this.logDiagnostic(d, logger);
        }
        logger.warn('-----');
    }

    logContext(logger: Logger) {
        const context = this.context;
        switch (context.context) {
            case 'epub':
                logger.warn(`Parse epub: ${context.title}`);
                break;
            default:
                assertNever(context.context);
        }
    }

    logDiagnostic(d: ParserDiagnostic, logger: Logger) {
        switch (d.diag) {
            case 'link-must-have-ref':
                logger.warn(`Links must have ref: ${xmlNode2String(d.node)}`);
                break;
            case 'no-title':
                logger.warn(`Couldn't find title in nodes: ${d.nodes.map(xmlNode2String)}`);
                break;
            case 'unexpected-attr':
                logger.warn(`Unexpected attribute '${d.name} = ${d.value}' on element: ${xmlNode2String(d.element)}`);
                break;
            case 'unexpected-node':
                logger.warn(`Unexpected node: ${xmlNode2String(d.node)}`);
                break;
            case 'unexpected-block':
                logger.warn(`Unexpected block: '${block2string(d.block)}'`);
                break;
            case 'couldnt-build-span':
                logger.warn(`Couldn't build span: '${block2string(d.block)}', context: ${d.context}`);
                break;
            case 'empty-book-title':
                logger.warn(`Expected book title to be not empty`);
                break;
            case 'extra-blocks-tail':
                logger.warn(`Unexpected blocks at tail: ${d.blocks.map(block2string)}`);
                break;
            case 'couldnt-resolve-ref':
                logger.warn(`Couldn't resolve footnote ref for id: ${d.id}`);
                break;
            case 'unknown-source':
                logger.warn(`Unknown epub source`);
                break;
            default:
                assertNever(d);
        }
    }
}

export type ParserContext =
    | Context<'epub'> & { title?: string }
    ;

type Context<K extends string> = { context: K };

export type ParserDiagnostic =
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

function block2string(block: Block): string {
    return JSON.stringify(block, undefined, 4);
}
