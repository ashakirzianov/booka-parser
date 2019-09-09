import { XmlTree, hasChildren } from './xmlTree';
import { caseInsensitiveEq, isWhitespaces } from '../utils';
import {
    Result, success, fail, seq, some, translate,
    StreamParser, headParser, makeStream, nextStream, not, Stream, successValue,
} from '../combinators';

export type TreeParser<Out = XmlTree, Env = undefined> = StreamParser<XmlTree, Out, Env>;

export function nameEq(n1: string, n2: string): boolean {
    return caseInsensitiveEq(n1, n2);
}

export function textNode<T, E = any>(f: (text: string) => T | null): TreeParser<T, E>;
export function textNode<E = any>(): TreeParser<string, E>;
export function textNode<T, E>(f?: (text: string) => T | null): TreeParser<T | string, E> {
    return headParser((n: XmlTree) => {
        if (n.type === 'text') {
            if (f) {
                const result = f(n.text);
                return result !== null ? successValue(n.text) : fail({ custom: 'xml-text-rejected' });
            } else {
                return successValue(n.text);
            }
        } else {
            return fail({ custom: 'expected-xml- text' });
        }
    });
}

export const whitespaces = textNode<boolean, any>(text => isWhitespaces(text) ? true : null);

export function whitespaced<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return translate(
        seq(whitespaces, parser),
        ([_, result]) => result,
    );
}

export function beforeWhitespaces<T, E>(parser: TreeParser<T, E>): TreeParser<T> {
    return translate(
        seq(parser, whitespaces),
        ([result, _]) => result,
    );
}

export function xmlChildren<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return fail({ custom: 'children: empty input' });
        }
        if (!hasChildren(head)) {
            return fail({ custom: 'children: no children' });
        }

        const result = parser(makeStream(head.children, input.env));
        if (result.success) {
            return success(result.value, nextStream(input), result.diagnostic);
        } else {
            return result;
        }
    };
}

export function parent<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return fail({ custom: 'parent: empty input' });
        }
        if (head.parent === undefined) {
            return fail({ custom: 'parent: no parent' });
        }

        const result = parser(makeStream([head.parent], input.env));
        if (result.success) {
            return success(result.value, nextStream(input), result.diagnostic);
        } else {
            return result;
        }
    };
}

export function between<T, E>(left: TreeParser<any, E>, right: TreeParser<any, E>, inside: TreeParser<T, E>): TreeParser<T, E> {
    return input => {
        const result = seq(
            some(not(left)),
            left,
            some(not(right)),
            right,
        )(input);

        return result.success
            ? inside(makeStream(result.value[2], input.env))
            : result
            ;
    };
}

function parsePathHelper<T, E>(pathComponents: string[], then: TreeParser<T, E>, input: Stream<XmlTree, E>): Result<Stream<XmlTree, E>, T> {
    if (pathComponents.length === 0) {
        return fail({ custom: 'parse path: can\'t parse to empty path' });
    }
    const pc = pathComponents[0];

    const childIndex = input.stream.findIndex(ch =>
        ch.type === 'element' && nameEq(ch.name, pc));
    const child = input.stream[childIndex];
    if (!child) {
        return fail({ custom: `parse path: ${pc}: can't find child` });
    }

    if (pathComponents.length < 2) {
        const next = makeStream(input.stream.slice(childIndex), input.env);
        const result = then(next);
        return result;
    }

    const nextNodes = hasChildren(child) ? child.children : [];
    const nextInput = makeStream(nextNodes, input.env);

    return parsePathHelper(pathComponents.slice(1), then, nextInput);
}

export function path<T, E>(paths: string[], then: TreeParser<T, E>): TreeParser<T, E> {
    return input => parsePathHelper(paths, then, input);
}