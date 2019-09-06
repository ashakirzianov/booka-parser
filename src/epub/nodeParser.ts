import { RawBookNode } from 'booka-common';
import { ParserDiagnoser } from '../log';
import {
    XmlNode, XmlNodeElement, isElement, XmlParser,
    XmlAttributes,
    stream,
    headParser,
    success,
    elementNode,
} from '../xml';
import { Constraint, ConstraintMap, checkValue, checkObject } from '../constraint';
import { equalsToOneOf } from '../utils';

export type EpubNodeParser = XmlParser<RawBookNode[], EpubNodeParserEnv>;
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
            return success([{ node: 'ignore' }], stream([], input.env));
        }
    };
}

export function ignoreClass(className: string) {
    return elementNode(el =>
        el.attributes.class === className
            ? { node: 'ignore' }
            : undefined
    );
}

export function ignoreTags(tags: string[]) {
    return elementNode(el =>
        equalsToOneOf(el.name, tags)
            ? { node: 'ignore' }
            : undefined
    );
}
