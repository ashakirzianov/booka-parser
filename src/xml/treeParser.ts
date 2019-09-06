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

export function textNode<T, E = undefined>(f: (text: string) => T | null): XmlParser<T, E>;
export function textNode<E = undefined>(): XmlParser<string, E>;
export function textNode<T, E>(f?: (text: string) => T | null): XmlParser<T | string, E> {
    return headParser((n: XmlNode) =>
        n.type === 'text'
            ? (f ? f(n.text) : n.text)
            : null
    );
}

export const whitespaces = textNode<boolean, any>(text => isWhitespaces(text) ? true : null);

export function whitespaced<T, E>(parser: XmlParser<T, E>): XmlParser<T, E> {
    return translate(
        seq(whitespaces, parser),
        ([_, result]) => result,
    );
}

export function beforeWhitespaces<T, E>(parser: XmlParser<T, E>): XmlParser<T> {
    return translate(
        seq(parser, whitespaces),
        ([result, _]) => result,
    );
}

export function children<T, E>(parser: XmlParser<T, E>): XmlParser<T, E> {
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

export function parent<T, E>(parser: XmlParser<T, E>): XmlParser<T, E> {
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

export function between<T, E>(left: XmlParser<any, E>, right: XmlParser<any, E>, inside: XmlParser<T, E>): XmlParser<T, E> {
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

function parsePathHelper<T, E>(pathComponents: string[], then: XmlParser<T, E>, input: Stream<XmlNode, E>): Result<Stream<XmlNode, E>, T> {
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

export function path<T, E>(paths: string[], then: XmlParser<T, E>): XmlParser<T, E> {
    return input => parsePathHelper(paths, then, input);
}
