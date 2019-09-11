import { Parser, success, fail, SuccessParser, ResultValue, some } from './base';
import { compoundDiagnostic } from './diagnostics';

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

export type HeadFn<In, Out, Env> = (head: In, env: Env) => ResultValue<Out>;
export function headParser<In, Out, Env = any>(f: HeadFn<In, Out, Env>): StreamParser<In, Out, Env> {
    return (input: Stream<In, Env>) => {
        const head = input.stream[0];
        if (head === undefined) {
            return fail('empty-stream');
        }
        const result = f(head, input.env);
        return result.success
            ? success(result.value, nextStream(input))
            : result;
    };
}

export function empty<T = any, E = any>(): StreamParser<T, undefined, E> {
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

export function fullParser<I, O, E>(parser: StreamParser<I, O, E>): SuccessStreamParser<I, O[], E> {
    return input => {
        const result = some(parser)(input);
        const tailDiag = result.next.stream.length > 0
            ? { custom: 'extra-nodes-tail', nodes: result.next.stream }
            : undefined;

        return success(
            result.value,
            result.next,
            compoundDiagnostic([result.diagnostic, tailDiag]),
        );
    };
}
