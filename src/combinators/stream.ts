import { Parser, yieldNext, reject, SuccessParser, some, ResultLast, expected, projectFirst, seq, yieldLast } from './base';
import { compoundDiagnostic, ParserDiagnostic } from './diagnostics';

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
    return input => {
        if (input.stream.length === 0) {
            return yieldNext(undefined, input);
        } else {
            return reject();
        }
    };
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

export function parseAll<In, Out, E>(single: StreamParser<In, Out, E>) {
    return projectFirst(seq(single, endOfInput()));
}

export function reportUnparsedTail<In, Out, E>(single: StreamParser<In, Out, E>, reporter: (stream: Stream<In, E>) => ParserDiagnostic) {
    return projectFirst(seq(single, input => {
        if (input.stream && input.stream.length > 0) {
            return yieldLast(undefined, reporter(input));
        } else {
            return yieldLast(undefined);
        }
    }));
}
