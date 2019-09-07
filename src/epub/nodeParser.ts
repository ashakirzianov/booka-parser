import { RawBookNode } from 'booka-common';
import { ParserDiagnoser } from '../log';
import {
    XmlNode, XmlNodeElement, isElement, XmlParser,
    XmlAttributes, makeStream, headParser, success,
    elementNode,
    fail,
    SuccessParser,
    Stream,
    some,
} from '../xml';
import { Constraint, ConstraintMap, checkValue, checkObject } from '../constraint';
import { equalsToOneOf, flatten } from '../utils';

// TODO: remove
export type XmlHandlerResult = RawBookNode[] | undefined;
export type XmlHandler = (x: XmlNode, env: EpubNodeParserEnv) => XmlHandlerResult;

export type EpubNodeParser<T = RawBookNode[]> = XmlParser<T, EpubNodeParserEnv>;
export type FullEpubParser = SuccessParser<Stream<XmlNode, EpubNodeParserEnv>, RawBookNode[]>;
export type EpubNodeParserEnv = {
    ds: ParserDiagnoser,
    nodeParser: XmlParser<RawBookNode[], EpubNodeParserEnv>,
    filePath: string,
};

export type SimpleHandler<T extends XmlNode = XmlNode> = (el: T, env: EpubNodeParserEnv) => (RawBookNode | undefined);

export type SimpleElementHandler = SimpleHandler<XmlNodeElement>;
export function constrainElement<N extends string>(
    nameConstraint: Constraint<string, N>,
    attrsConstraint: ConstraintMap<XmlAttributes>,
    handler: SimpleElementHandler,
): EpubNodeParser {
    return headParser((node, env) => {
        if (!isElement(node)) {
            return null;
        }

        const nameCheck = checkValue(node.name, nameConstraint);
        if (!nameCheck) {
            return null;
        }

        const attrCheck = checkObject(node.attributes, attrsConstraint);
        for (const failedCheck of attrCheck) {
            env.ds.add({
                diag: 'unexpected-attr',
                element: node,
                name: failedCheck.key,
                value: failedCheck.value,
                constraint: failedCheck.constraint,
            });
        }

        const result = handler(node, env);
        return result
            ? [result]
            : null;
    });
}

export function expectToParse(parser: EpubNodeParser): EpubNodeParser {
    return input => {
        const result = parser(input);
        if (result.success) {
            return result;
        } else {
            input.env.ds.add({
                diag: 'unexpected-node',
                node: input.stream[0],
            });
            return success([{ node: 'ignore' }], makeStream([], input.env));
        }
    };
}

export function ignoreClass(className: string): EpubNodeParser {
    return elementNode<RawBookNode[], EpubNodeParserEnv>(el =>
        el.attributes.class === className
            ? [{ node: 'ignore' }]
            : null
    );
}

export function ignoreTags(tags: string[]): EpubNodeParser {
    return elementNode<RawBookNode[], EpubNodeParserEnv>(el =>
        equalsToOneOf(el.name, tags)
            ? [{ node: 'ignore' }]
            : null
    );
}

export function fullParser(parser: EpubNodeParser): FullEpubParser {
    return input => {
        const result = some(parser)(input);
        if (result.next.stream.length > 0) {
            input.env.ds.add({ diag: 'extra-nodes-tail', nodes: result.next.stream });
        }

        return success(flatten(result.value), result.next, result.message);
    };
}

// TODO: remove
export function handleElement(handler: SimpleElementHandler): EpubNodeParser {
    return headParser((node, env) => {
        if (!isElement(node)) {
            return null;
        }

        const result = handler(node, env);
        return result ? [result] : null;
    });
}

// TODO: remove
export function parserHook(buildParser: (env: EpubNodeParserEnv) => EpubNodeParser): EpubNodeParser {
    return input => {
        const parser = buildParser(input.env);
        const result = parser(input);

        return result;
    };
}

// TODO: remove
export function combineHandlers(handlers: EpubNodeParser[]): EpubNodeParser {
    return input => {
        for (const handler of handlers) {
            const result = handler(input);
            if (result.success) {
                return result;
            }
        }

        return fail('');
    };
}

// TODO: remove
export function expectToHandle(handler: EpubNodeParser): XmlHandler {
    return (node: XmlNode, env: EpubNodeParserEnv): RawBookNode[] => {
        const result = handler(makeStream([node], env));
        if (result.success) {
            return result.value;
        } else {
            env.ds.add({
                diag: 'unexpected-node',
                node: node,
            });
            return [{ node: 'ignore' }];
        }
    };
}

// TODO: remove
export function handleXml(handler: SimpleHandler): EpubNodeParser {
    return headParser((node, env) => {
        const result = handler(node, env);
        return result
            ? [result]
            : null;
    });
}

// TODO: remove
export function makeHandler(parser: EpubNodeParser): XmlHandler {
    return (node, env) => {
        const stream = makeStream([node], env);
        const result = parser(stream);

        return result.success
            ? result.value
            : [{ node: 'ignore' }];
    };
}
