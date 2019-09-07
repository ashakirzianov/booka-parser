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
    HeadFn,
} from '../xml';
import { Constraint, ConstraintMap, checkValue, checkObject } from '../constraint';
import { equalsToOneOf, flatten } from '../utils';

// TODO: remove
export type TreeToNodes<T extends XmlNode = XmlNode> = (x: T, env: EpubNodeParserEnv) => (RawBookNode[] | null);

export type EpubNodeParser<T = RawBookNode[]> = XmlParser<T, EpubNodeParserEnv>;
export type FullEpubParser = SuccessParser<Stream<XmlNode, EpubNodeParserEnv>, RawBookNode[]>;
export type EpubNodeParserEnv = {
    ds: ParserDiagnoser,
    nodeParser: XmlParser<RawBookNode[], EpubNodeParserEnv>,
    filePath: string,
};

export const headNode = (fn: HeadFn<XmlNode, RawBookNode[], EpubNodeParserEnv>) => headParser(fn);

export function constrainElement<N extends string>(
    nameConstraint: Constraint<string, N>,
    attrsConstraint: ConstraintMap<XmlAttributes>,
    fn: TreeToNodes<XmlNodeElement>,
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

        const result = fn(node, env);
        return result
            ? result
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
