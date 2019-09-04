import { ParserDiagnoser } from '../log';
import {
    XmlNode, XmlNodeElement, isElement, XmlParser,
    XmlAttributes,
} from '../xml';
import { Block } from '../bookBlocks';
import { Constraint, ConstraintMap, checkValue, checkObject } from '../constraint';

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
export function constrainElement<N extends string>(
    nameConstraint: Constraint<string, N>,
    attrsConstraint: ConstraintMap<XmlAttributes>,
    handler: SimpleElementHandler,
): NodeHandler {
    return (node, env) => {
        if (!isElement(node)) {
            return undefined;
        }

        const nameCheck = checkValue(node.name, nameConstraint);
        if (!nameCheck) {
            return undefined;
        }

        const attrCheck = checkObject(node.attributes, attrsConstraint);
        for (const fail of attrCheck) {
            env.ds.add({
                diag: 'unexpected-attr',
                element: node,
                name: fail.key,
                value: fail.value,
                constraint: fail.constraint,
            });
        }

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
