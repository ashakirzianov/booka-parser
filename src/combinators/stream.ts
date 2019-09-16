import { Parser, yieldNext, reject, SuccessParser, some, ResultLast, expected, projectFirst, seq } from './base';
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
export function nextStream<T, E>(input: Stream<T, E>): Stream<T, E> | undefined {
    return {
        stream: input.stream.slice(1),
        env: input.env,
    };
}

export type HeadFn<In, Out, Env> = (head: In, env: Env) => ResultLast<Out>;
export function headParser<In, Out, Env = any>(f: HeadFn<In, Out, Env>): StreamParser<In, Out, Env> {
    return (input: Stream<In, Env>) => {
        const head = input.stream[0];
        if (head === undefined) {
            return reject();
        }
        const result = f(head, input.env);
        return result.success
            ? {
                ...result,
                next: nextStream(input),
            }
            : result;
    };
}

export function endOfInput<T = any, E = any>(): StreamParser<T, undefined, E> {
    return input => input.stream.length === 0
        ? yieldNext(undefined, input)
        : reject();
}

export type StringOrFn<T = unknown> = string | ((x: Stream<T>) => string);
export function expectEoi<T = unknown>(messageOrFn: StringOrFn<T>) {
    return expected(endOfInput(), undefined, stream => ({
        diag: 'expected-eoi',
        message: typeof messageOrFn === 'function'
            ? messageOrFn(stream)
            : messageOrFn,
    }));
}

export function expectParseAll<In, Out, E>(single: StreamParser<In, Out, E>, messageOrFn: StringOrFn<In>) {
    return projectFirst(seq(single, expectEoi(messageOrFn)));
}

export function not<T, E>(parser: StreamParser<T, any, E>): StreamParser<T, T, E> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return reject();
        }

        const result = parser(input);
        return !result.success
            ? yieldNext(head, nextStream(input))
            : reject();
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
        if (result.next && result.next.stream.length > 0) {
            return {
                ...result,
                diagnostic: compoundDiagnostic([result.diagnostic, {
                    diag: 'extra-nodes-tail', nodes: result.next.stream,
                }]),
            };
        } else {
            return result;
        }
    };
}
