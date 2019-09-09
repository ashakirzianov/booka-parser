import { Parser, success, fail } from './base';
// TODO: remove
import { Predicate } from './predicate';

export type Stream<T, E = undefined> = {
    stream: T[],
    env: E,
};
export type StreamParser<TIn, TOut = TIn, TEnv = undefined> =
    Parser<Stream<TIn, TEnv>, TOut>;

export function makeStream<I>(arr: I[]): Stream<I>;
export function makeStream<I, E>(arr: I[], env: E): Stream<I, E>;
export function makeStream<I, E = undefined>(arr: I[], env?: E): Stream<I, E> {
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

export type HeadFn<In, Out, Env> = (head: In, env: Env) => (Out | null);
export function headParser<In, Out, Env = undefined>(f: HeadFn<In, Out, Env>): StreamParser<In, Out, Env> {
    return (input: Stream<In, Env>) => {
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

export function not<T, E>(parser: StreamParser<T, any, E>): StreamParser<T, T, E> {
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

export function envParser<I, O, E>(f: (env: E) => StreamParser<I, O, E>): StreamParser<I, O, E> {
    return input => {
        const parser = f(input.env);
        const result = parser(input);
        return result;
    };
}

export function predicate<TI, TO, TE = any>(pred: Predicate<TI, TO>): StreamParser<TI, TO, TE> {
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
