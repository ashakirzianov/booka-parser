import { XmlNode, hasChildren } from './xmlNode';
import { caseInsensitiveEq, isWhitespaces } from '../utils';
import {
    Result, success, fail, seq, some, translate,
} from './parserCombinators';
import { StreamParser, headParser, stream, nextStream, not, Stream } from './streamParser';

export type XmlParser<Out = XmlNode, Env = undefined> = StreamParser<XmlNode, Out, Env>;

export function nameEq(n1: string, n2: string): boolean {
    return caseInsensitiveEq(n1, n2);
}

const textNodeImpl = <T>(f?: (text: string) => T | null) => headParser((n: XmlNode) =>
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
        const head = input.stream[0];
        if (head === undefined) {
            return fail('children: empty input');
        }
        if (!hasChildren(head)) {
            return fail('children: no children');
        }

        const result = parser(stream(head.children, input.env));
        if (result.success) {
            return success(result.value, nextStream(input), result.message);
        } else {
            return result;
        }
    };
}

export function parent<T>(parser: XmlParser<T>): XmlParser<T> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return fail('parent: empty input');
        }
        if (head.parent === undefined) {
            return fail('parent: no parent');
        }

        const result = parser(stream([head.parent], input.env));
        if (result.success) {
            return success(result.value, nextStream(input), result.message);
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
            ? inside(stream(result.value[2], input.env))
            : result
            ;
    };
}

function parsePathHelper<T>(pathComponents: string[], then: XmlParser<T>, input: Stream<XmlNode>): Result<Stream<XmlNode>, T> {
    if (pathComponents.length === 0) {
        return fail('parse path: can\'t parse to empty path');
    }
    const pc = pathComponents[0];

    const childIndex = input.stream.findIndex(ch =>
        ch.type === 'element' && nameEq(ch.name, pc));
    const child = input.stream[childIndex];
    if (!child) {
        return fail(`parse path: ${pc}: can't find child`);
    }

    if (pathComponents.length < 2) {
        const next = stream(input.stream.slice(childIndex), input.env);
        const result = then(next);
        return result;
    }

    const nextNodes = hasChildren(child) ? child.children : [];
    const nextInput = stream(nextNodes, input.env);

    return parsePathHelper(pathComponents.slice(1), then, nextInput);
}

export function path<T>(paths: string[], then: XmlParser<T>): XmlParser<T> {
    return input => parsePathHelper(paths, then, input);
}
