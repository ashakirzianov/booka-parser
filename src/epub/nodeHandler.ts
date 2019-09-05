import { RawBookNode } from 'booka-common';
import { ParserDiagnoser } from '../log';
import {
    XmlNode, XmlNodeElement, isElement, XmlParser,
    XmlAttributes,
} from '../xml';
import { Constraint, ConstraintMap, checkValue, checkObject } from '../constraint';
import { equalsToOneOf } from '../utils';

export type XmlHandlerEnv = {
    ds: ParserDiagnoser,
    xml2blocks: (x: XmlNode) => RawBookNode[],
    filePath: string,
};
export type XmlHandlerResult = RawBookNode[] | undefined;
export type XmlHandler = (x: XmlNode, env: XmlHandlerEnv) => XmlHandlerResult;

export type SimpleHandler<T extends XmlNode = XmlNode> = (el: T, env: XmlHandlerEnv) => (RawBookNode | undefined);

export function handleXml(handler: SimpleHandler): XmlHandler {
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
): XmlHandler {
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

export function handleElement(handler: SimpleElementHandler): XmlHandler {
    return (node, env) => {
        if (!isElement(node)) {
            return undefined;
        }

        const result = handler(node, env);
        return result ? [result] : undefined;
    };
}

export function parserHook(buildParser: (env: XmlHandlerEnv) => XmlParser<RawBookNode[]>): XmlHandler {
    return (node, env) => {
        const parser = buildParser(env);
        const result = parser([node]);

        return result.success
            ? result.value
            : undefined;
    };
}

export function combineHandlers(handlers: XmlHandler[]): XmlHandler {
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

export function expectToHandle(handler: XmlHandler) {
    return (node: XmlNode, env: XmlHandlerEnv): RawBookNode[] => {
        const result = handler(node, env);
        if (result) {
            return result;
        } else {
            env.ds.add({
                diag: 'unexpected-node',
                node: node,
            });
            return [{ node: 'ignore' }];
        }
    };
}

export function ignoreClass(className: string) {
    return handleElement(el =>
        el.attributes.class === className
            ? { node: 'ignore' }
            : undefined
    );
}

export function ignoreTags(tags: string[]) {
    return handleElement(el =>
        equalsToOneOf(el.name, tags)
            ? { node: 'ignore' }
            : undefined
    );
}
