import {
    Stream, StreamParser, ParserDiagnostic, SuccessLast, yieldLast,
    compoundDiagnostic,
} from '../combinators';
import { Xml, xml2string } from '../xml';
import { BookNode, Semantic, FlagSemanticKey } from 'booka-common';
import { isWhitespaces } from '../utils';

export type AttributesHookResult = {
    flag?: FlagSemanticKey,
    semantics?: Semantic[],
    diag?: ParserDiagnostic,
};
export type AttributesHook = (element: string, attr: string, value: string) => AttributesHookResult;
export type XmlHooks = {
    attributesHook?: AttributesHook,
};
export type Xml2NodesEnv = {
    hooks?: XmlHooks,
    filePath: string,
};
export type Input = Stream<Xml, Xml2NodesEnv>;
export type NodeParser = StreamParser<Xml, BookNode[], Xml2NodesEnv>;

export function buildRefId(filePath: string, id: string) {
    return `${filePath}#${id}`;
}

export function expectEmptyContent(children: Xml[]): ParserDiagnostic {
    return children.length > 0
        ? {
            diag: 'unexpected children',
            xmls: children.map(xml2string),
        }
        : undefined;
}

export function unexpectedNode(node: Xml, context?: any): ParserDiagnostic {
    return {
        diag: 'unexpected node',
        xml: xml2string(node),
        ...(context !== undefined && { context }),
    };
}

export function shouldIgnore(node: Xml): boolean {
    switch (node.type) {
        case 'text':
            return node.text.startsWith('\n') && isWhitespaces(node.text);
        case 'element':
            switch (node.name) {
                case 'meta':
                case 'basefont':
                case 'kbd':
                case 'tt':
                case 'svg':
                case 'br':
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
type NodeProcessor<T> = (node: Xml, env: Xml2NodesEnv) => ProcessNodeResult<T>;
export function processNodes<T>(nodes: Xml[], env: Xml2NodesEnv, proc: NodeProcessor<T>): SuccessLast<T[]> {
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
