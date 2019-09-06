import { Parser, success, fail } from './parserCombinators';

export type Stream<T, E = undefined> = {
    stream: T[],
    env: E,
};
export type StreamParser<TIn, TOut = TIn, TEnv = undefined> =
    Parser<Stream<TIn, TEnv>, TOut>;

export function nextStream<T, E>(stream: Stream<T, E>): Stream<T, E> {
    return {
        stream: stream.stream.slice(1),
        env: stream.env,
    };
}

export function headParser<TIn, TOut, TEnv = undefined>(f: (n: TIn, env: TEnv) => TOut | null): StreamParser<TIn, TOut, TEnv> {
    return (input: Stream<TIn, TEnv>) => {
        const head = input[0];
        if (head === undefined) {
            return fail('first node: empty input');
        }
        const result = f(head, input.env);
        return result === null
            ? fail('first node: func returned null')
            : success(result, nextStream(input));
    };
}

export function end<T = any>(): StreamParser<T, undefined> {
    return input => input.stream.length === 0
        ? success(undefined, input)
        : fail(`Expected end of input, got: '${input}`);
}

export function not<T>(parser: StreamParser<T, any>): StreamParser<T, T> {
    return input => {
        const head = input[0];
        if (head === undefined) {
            return fail('not: empty input');
        }

        const result = parser(input);
        return !result.success
            ? success(head, nextStream(input))
            : fail('not: parser succeed');
    };
}
