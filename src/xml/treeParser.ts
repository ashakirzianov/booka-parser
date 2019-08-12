import { XmlNode, hasChildren } from './xmlNode';
import { caseInsensitiveEq, isWhitespaces } from '../utils';
import {
    Result, success, fail, seq, some, translate,
} from './parserCombinators';
import { ArrayParser, headParser, not } from './arrayParser';

export type XmlParser<TOut = XmlNode> = ArrayParser<XmlNode, TOut>;

export const headNode = headParser<XmlNode>();
export function nameEq(n1: string, n2: string): boolean {
    return caseInsensitiveEq(n1, n2);
}

const textNodeImpl = <T>(f?: (text: string) => T | null) => headNode(n =>
    n.type === 'text'
        ? (f ? f(n.text) : n.text)
        : null
);

export function textNode<T>(f: (text: string) => T | null): XmlParser<T>;
export function textNode(): XmlParser<string>;
export function textNode<T>(f?: (text: string) => T | null): XmlParser<T | string> {
    return textNodeImpl(f);
}

export const whitespaces = textNode(text => isWhitespaces(text) ? true : null);

export function whitespaced<T>(parser: XmlParser<T>): XmlParser<T> {
    return translate(
        seq(whitespaces, parser),
        ([_, result]) => result,
    );
}

export function beforeWhitespaces<T>(parser: XmlParser<T>): XmlParser<T> {
    return translate(
        seq(parser, whitespaces),
        ([result, _]) => result,
    );
}

export function children<T>(parser: XmlParser<T>): XmlParser<T> {
    return input => {
        const head = input[0];
        if (head === undefined) {
            return fail('children: empty input');
        }
        if (!hasChildren(head)) {
            return fail('children: no children');
        }

        const result = parser(head.children);
        if (result.success) {
            return success(result.value, input.slice(1), result.message);
        } else {
            return result;
        }
    };
}

export function parent<T>(parser: XmlParser<T>): XmlParser<T> {
    return input => {
        const head = input[0];
        if (head === undefined) {
            return fail('parent: empty input');
        }
        if (head.parent === undefined) {
            return fail('parent: no parent');
        }

        const result = parser([head.parent]);
        if (result.success) {
            return success(result.value, input.slice(1), result.message);
        } else {
            return result;
        }
    };
}

export function between<T>(left: XmlParser<any>, right: XmlParser<any>, inside: XmlParser<T>): XmlParser<T> {
    return input => {
        const result = seq(
            some(not(left)),
            left,
            some(not(right)),
            right,
        )(input);

        return result.success
            ? inside(result.value[2])
            : result
            ;
    };
}

function parsePathHelper<T>(pathComponents: string[], then: XmlParser<T>, input: XmlNode[]): Result<XmlNode[], T> {
    if (pathComponents.length === 0) {
        return fail('parse path: can\'t parse to empty path');
    }
    const pc = pathComponents[0];

    const childIndex = input.findIndex(ch =>
        ch.type === 'element' && nameEq(ch.name, pc));
    const child = input[childIndex];
    if (!child) {
        return fail(`parse path: ${pc}: can't find child`);
    }

    if (pathComponents.length < 2) {
        return then(input.slice(childIndex));
    }

    const nextInput = hasChildren(child) ? child.children : [];

    return parsePathHelper(pathComponents.slice(1), then, nextInput);
}

export function path<T>(paths: string[], then: XmlParser<T>): XmlParser<T> {
    return (input: XmlNode[]) => parsePathHelper(paths, then, input);
}
