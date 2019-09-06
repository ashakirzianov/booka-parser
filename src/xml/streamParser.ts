import { Parser, success, fail } from './parserCombinators';
// TODO: remove
import { Predicate, andPred } from './predicate';

export type Stream<T, E = undefined> = {
    stream: T[],
    env: E,
};
export type StreamParser<TIn, TOut = TIn, TEnv = undefined> =
    Parser<Stream<TIn, TEnv>, TOut>;

export function stream<I>(arr: I[]): Stream<I>;
export function stream<I, E>(arr: I[], env: E): Stream<I, E>;
export function stream<I, E = undefined>(arr: I[], env?: E): Stream<I, E> {
    return {
        stream: arr,
        env: env as any,
    };
}
export function nextStream<T, E>(input: Stream<T, E>): Stream<T, E> {
    return {
        stream: input.stream.slice(1),
        env: input.env,
    };
}

export function headParser<TIn, TOut, TEnv = undefined>(f: (n: TIn, env: TEnv) => TOut | null): StreamParser<TIn, TOut, TEnv> {
    return (input: Stream<TIn, TEnv>) => {
        const head = input.stream[0];
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
        const head = input.stream[0];
        if (head === undefined) {
            return fail('not: empty input');
        }

        const result = parser(input);
        return !result.success
            ? success(head, nextStream(input))
            : fail('not: parser succeed');
    };
}

export function predicate<TI, TO, TE = undefined>(pred: Predicate<TI, TO>): StreamParser<TI, TO, TE> {
    return input => {
        const head = input.stream[0];
        if (!head) {
            return fail('pred: empty input');
        }

        const result = pred(head);
        if (result.success) {
            return success(result.value, nextStream(input), result.message);
        } else {
            return fail(result.message);
        }
    };
}
