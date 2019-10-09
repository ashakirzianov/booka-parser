import { Stream, StreamParser, ParserDiagnostic } from '../combinators';
import { XmlTree, tree2String } from '../xmlStringParser';
import { BookContentNode } from 'booka-common';
import { isWhitespaces } from '../utils';

export type IgnoreNode = { node: 'ignore' };
export type ResultNode = BookContentNode | IgnoreNode;
export type Env = {};
export type Input = Stream<XmlTree, Env>;
export type NodeParser = StreamParser<XmlTree, BookContentNode[], Env>;
export type SingleNodeParser = StreamParser<XmlTree, ResultNode, Env>;

export function isContent(node: ResultNode): node is BookContentNode {
    return node.node !== 'ignore';
}

export function expectEmptyContent(children: XmlTree[]): ParserDiagnostic {
    return children.length > 0
        ? {
            diag: 'unexpected children',
            xmls: children.map(tree2String),
        }
        : undefined;
}

export function unexpectedNode(node: XmlTree): ParserDiagnostic {
    return {
        diag: 'unexpected node',
        xml: tree2String(node),
    };
}

export function isWhitespaceNode(node: XmlTree): boolean {
    return node.type === 'text' && isWhitespaces(node.text);
}
