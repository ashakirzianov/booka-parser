import { ParserDiagnoser } from '../log';
import { XmlNode, XmlNodeElement, isElement, XmlParser } from '../xml';
import { Block } from '../bookBlocks';
import { equalsToOneOf } from '../utils';

export type NodeHandlerEnv = {
    ds: ParserDiagnoser,
    node2blocks: (x: XmlNode) => Block[],
    filePath: string,
};
export type NodeHandlerResult = Block[] | undefined;
export type NodeHandler = (x: XmlNode, env: NodeHandlerEnv) => NodeHandlerResult;

export type SimpleHandler<T extends XmlNode = XmlNode> = (el: T, env: NodeHandlerEnv) => (Block | undefined);

export function handleNode(handler: SimpleHandler): NodeHandler {
    return (node, env) => {
        const result = handler(node, env);
        return result
            ? [result]
            : undefined;
    };
}

export type SimpleElementHandler = SimpleHandler<XmlNodeElement>;
export function handleName(name: string, handler: SimpleElementHandler): NodeHandler {
    return handleNames([name], [], handler);
}
export function handleNames(names: string[], expectedAttributes: string[] | undefined, handler: SimpleElementHandler): NodeHandler {
    return (node, env) => {
        if (!isElement(node)) {
            return undefined;
        }

        if (!equalsToOneOf(node.name, names)) {
            return undefined;
        }

        // if (expectedAttributes) {
        //     for (const [attr, value] of Object.entries(node.attributes)) {
        //         if (!expectedAttributes.some(e => e === attr)) {
        //             env.ds.add({
        //                 diag: 'unexpected-attr',
        //                 name: attr,
        //                 value,
        //                 element: node,
        //             });
        //         }
        //     }
        // }

        const result = handler(node, env);
        return result
            ? [result]
            : undefined;
    };
}

export function handleElement(handler: SimpleElementHandler): NodeHandler {
    return (node, env) => {
        if (!isElement(node)) {
            return undefined;
        }

        const result = handler(node, env);
        return result ? [result] : undefined;
    };
}

export function parserHook(buildParser: (env: NodeHandlerEnv) => XmlParser<Block[]>): NodeHandler {
    return (node, env) => {
        const parser = buildParser(env);
        const result = parser([node]);

        return result.success
            ? result.value
            : undefined;
    };
}

export function combineHandlers(handlers: NodeHandler[]): NodeHandler {
    return (node, env) => {
        for (const handler of handlers) {
            const result = handler(node, env);
            if (result) {
                return result;
            }
        }

        return undefined;
    };
}

export function expectToHandle(handler: NodeHandler) {
    return (node: XmlNode, env: NodeHandlerEnv): Block[] => {
        const result = handler(node, env);
        if (result) {
            return result;
        } else {
            env.ds.add({
                diag: 'unexpected-node',
                node: node,
            });
            return [{ block: 'ignore' }];
        }
    };
}
