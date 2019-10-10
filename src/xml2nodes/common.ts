import {
    Stream, StreamParser, ParserDiagnostic, SuccessLast, yieldLast,
    compoundDiagnostic,
} from '../combinators';
import { XmlTree, tree2String } from '../xmlStringParser';
import { BookContentNode } from 'booka-common';
import { isWhitespaces } from '../utils';

export type Xml2NodesEnv = {
    filePath: string,
};
export type Input = Stream<XmlTree, Xml2NodesEnv>;
export type NodeParser = StreamParser<XmlTree, BookContentNode[], Xml2NodesEnv>;

export function expectEmptyContent(children: XmlTree[]): ParserDiagnostic {
    return children.length > 0
        ? {
            diag: 'unexpected children',
            xmls: children.map(tree2String),
        }
        : undefined;
}

export function unexpectedNode(node: XmlTree, context?: any): ParserDiagnostic {
    return {
        diag: 'unexpected node',
        xml: tree2String(node),
        ...(context !== undefined && { context }),
    };
}

export function shouldIgnore(node: XmlTree): boolean {
    switch (node.type) {
        case 'text':
            return node.text.startsWith('\n') && isWhitespaces(node.text);
        case 'element':
            switch (node.name) {
                case 'svg':
                    return true;
                default:
                    return false;
            }
        default:
            return false;
    }
}

type ProcessNodeResult<T> = {
    values?: T[],
    diag?: ParserDiagnostic,
};
type NodeProcessor<T> = (node: XmlTree, env: Xml2NodesEnv) => ProcessNodeResult<T>;
export function processNodes<T>(nodes: XmlTree[], env: Xml2NodesEnv, proc: NodeProcessor<T>): SuccessLast<T[]> {
    const diags: ParserDiagnostic[] = [];
    const results: T[] = [];
    for (const node of nodes) {
        if (shouldIgnore(node)) {
            continue;
        }
        const result = proc(node, env);
        diags.push(result.diag);
        if (result.values !== undefined) {
            results.push(...result.values);
        }
    }

    return yieldLast(results, compoundDiagnostic(diags));
}
