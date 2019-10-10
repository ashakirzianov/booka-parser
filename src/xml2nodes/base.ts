import { Stream, StreamParser, ParserDiagnostic, ResultLast, SuccessLast, yieldLast, compoundDiagnostic } from '../combinators';
import { XmlTree, tree2String, XmlTreeElement } from '../xmlStringParser';
import { BookContentNode } from 'booka-common';
import { isWhitespaces } from '../utils';

export type Env = {};
export type Input = Stream<XmlTree, Env>;
export type NodeParser = StreamParser<XmlTree, BookContentNode[], Env>;

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

export function isWhitespaceNode(node: XmlTree): boolean {
    return node.type === 'text' && isWhitespaces(node.text);
}

// TODO: remove ?
export function reportUnexpected<T>(nodes: XmlTree[], env: Env, fn: (node: XmlTreeElement, env: Env) => ResultLast<T>): SuccessLast<T[]> {
    const diags: ParserDiagnostic[] = [];
    const results: T[] = [];
    for (const node of nodes) {
        if (shouldIgnore(node)) {
            continue;
        } else if (node.type !== 'element') {
            diags.push(unexpectedNode(node));
        } else {
            const result = fn(node, env);
            if (result.success) {
                diags.push(result.diagnostic);
                results.push(result.value);
            } else {
                diags.push(unexpectedNode(node));
            }
        }
    }

    return yieldLast(results, compoundDiagnostic(diags));
}

// TODO: do not export ?
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
type NodeProcessor<T> = (node: XmlTree, env: Env) => ProcessNodeResult<T>;
export function processNodes<T>(nodes: XmlTree[], env: Env, proc: NodeProcessor<T>): SuccessLast<T[]> {
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
