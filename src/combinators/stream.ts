import { Parser, success, fail, SuccessParser } from './base';
// TODO: remove
import { Predicate } from './predicate';

export type Stream<T, E = undefined> = {
    stream: T[],
    env: E,
};
export type StreamParser<TIn, TOut = TIn, TEnv = undefined> =
    Parser<Stream<TIn, TEnv>, TOut>;
export type SuccessStreamParser<I, O, E> = SuccessParser<Stream<I, E>, O>;

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
export function emptyStream<E>(env: E): Stream<any, E> {
    return makeStream([], env);
}

export type HeadFn<In, Out, Env> = (head: In, env: Env) => (Out | null);
export function headParser<In, Out, Env = undefined>(f: HeadFn<In, Out, Env>): StreamParser<In, Out, Env> {
    return (input: Stream<In, Env>) => {
        const head = input.stream[0];
        if (head === undefined) {
            return fail('empty-stream');
        }
        const result = f(head, input.env);
        return result === null
            ? fail('reject-head')
            : success(result, nextStream(input));
    };
}

export function end<T = any>(): StreamParser<T, undefined> {
    return input => input.stream.length === 0
        ? success(undefined, input)
        : fail({ custom: `Expected end of input`, rest: input });
}

export function not<T, E>(parser: StreamParser<T, any, E>): StreamParser<T, T, E> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return fail('empty-stream');
        }

        const result = parser(input);
        return !result.success
            ? success(head, nextStream(input))
            : fail('not-parser-succ');
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
            return fail('empty-stream');
        }

        const result = pred(head);
        if (result.success) {
            return success(result.value, nextStream(input), result.diagnostic);
        } else {
            return fail(result.diagnostic);
        }
    };
}
