import { Result, yieldOne, ResultLast } from './base';
import { Stream } from './stream';
import { ParserDiagnostic, compoundDiagnostic } from './diagnostics';

export type AsyncParser<I, O> = (input: I) => Promise<Result<I, O>>;
export type AsyncFullParser<I, O> = (input: I) => Promise<ResultLast<O>>;
export type AsyncStreamParser<I, O, E> = AsyncParser<Stream<I, E>, O>;

export function andAsync<TI, T1, T2>(
    p1: AsyncParser<TI, T1>, p2: AsyncParser<TI, T2>,
): AsyncParser<TI, [T1, T2]>;
export function andAsync<TI, T1, T2, T3>(
    p1: AsyncParser<TI, T1>, p2: AsyncParser<TI, T2>, p3: AsyncParser<TI, T3>,
): AsyncParser<TI, [T1, T2, T3]>;
export function andAsync<TI, T1, T2, T3, T4>(
    p1: AsyncParser<TI, T1>, p2: AsyncParser<TI, T2>, p3: AsyncParser<TI, T3>, p4: AsyncParser<TI, T4>,
): AsyncParser<TI, [T1, T2, T3, T4]>;
export function andAsync<TI, TS>(...ps: Array<AsyncParser<TI, TS>>): AsyncParser<TI, TS[]>;
export function andAsync<T>(...ps: Array<AsyncParser<T, any>>): AsyncParser<T, any[]> {
    return async input => {
        const results: any[] = [];
        const diagnostics: ParserDiagnostic[] = [];
        let lastInput: T | undefined = input;
        for (let i = 0; i < ps.length; i++) {
            const result = await ps[i](input);
            if (!result.success) {
                return result;
            }
            results.push(result.value);
            diagnostics.push(result.diagnostic);
            lastInput = result.next;
        }

        const diagnostic = compoundDiagnostic(diagnostics);
        return yieldOne(results, lastInput, diagnostic);
    };
}

export function translateAsync<TI, From, To>(parser: AsyncParser<TI, From>, f: (from: From) => To): AsyncParser<TI, To> {
    return async input => {
        const from = await parser(input);
        if (from.success) {
            const translated = f(from.value);
            return yieldOne(translated, from.next, from.diagnostic);
        } else {
            return from;
        }
    };
}

export function pipeAsync<T1, T2, TR>(p1: AsyncFullParser<T1, T2>, p2: AsyncFullParser<T2, TR>): AsyncFullParser<T1, TR> {
    return async input => {
        const r1 = await p1(input);
        if (!r1.success) {
            return r1;
        }

        const r2 = await p2(r1.value);
        return {
            ...r2,
            diagnostic: compoundDiagnostic([r1.diagnostic, r2.diagnostic]),
        };
    };
}
