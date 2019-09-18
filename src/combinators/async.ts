import { Result, yieldNext, ResultLast, reject } from './base';
import { ParserDiagnostic, compoundDiagnostic } from './diagnostics';

export type AsyncParser<I, O> = (input: I) => Promise<Result<I, O>>;
export type AsyncFullParser<I, O> = (input: I) => Promise<ResultLast<O>>;

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
        let lastNext: T | undefined = input;
        for (let i = 0; i < ps.length; i++) {
            const result = await ps[i](input);
            if (!result.success) {
                return result;
            }
            results.push(result.value);
            diagnostics.push(result.diagnostic);
            lastNext = result.next;
        }

        const diagnostic = compoundDiagnostic(diagnostics);
        return yieldNext(results, lastNext, diagnostic);
    };
}

export function translateAsync<TI, From, To>(parser: AsyncFullParser<TI, From>, f: (from: From) => Promise<To>): AsyncFullParser<TI, To>;
export function translateAsync<TI, From, To>(parser: AsyncParser<TI, From>, f: (from: From) => Promise<To>): AsyncParser<TI, To>;
export function translateAsync<TI, From, To>(parser: AsyncParser<TI, From>, f: (from: From) => Promise<To>): AsyncParser<TI, To> {
    return async input => {
        const from = await parser(input);
        if (from.success) {
            const translated = await f(from.value);
            return {
                ...from,
                value: translated,
            };
        } else {
            return from;
        }
    };
}

export function pipeAsync<T1, T2, TR>(p1: AsyncFullParser<T1, T2>, p2: AsyncFullParser<T2, TR>): AsyncFullParser<T1, TR>;
export function pipeAsync<T1, T2, T3, TR>(
    p1: AsyncFullParser<T1, T2>,
    p2: AsyncFullParser<T2, T3>,
    p3: AsyncFullParser<T3, TR>
): AsyncFullParser<T1, TR>;
export function pipeAsync(...ps: Array<AsyncFullParser<any, any>>): AsyncFullParser<any, any> {
    return async input => {
        const diags: ParserDiagnostic[] = [];
        let currInput = input;
        let r: any = undefined;
        for (const p of ps) {
            r = await p(currInput);
            diags.push(r.diagnostic);
            if (!r.success) {
                return {
                    ...r,
                    diagnostic: compoundDiagnostic(diags),
                };
            }
            currInput = r.value;
        }

        return {
            ...r,
            diagnostic: compoundDiagnostic(diags),
        };
    };
}

export function alwaysYieldAsync<In, Out>(f: (input: In) => Promise<Out>): AsyncParser<In, Out> {
    return async input => {
        const result = await f(input);
        return yieldNext(result, input);
    };
}

export type DeclaredAsyncParser<TIn, TOut> = {
    (input: TIn): Promise<Result<TIn, TOut>>,
    implementation: AsyncParser<TIn, TOut>,
};
export function declareAsync<TIn, TOut>(): DeclaredAsyncParser<TIn, TOut> {
    const declared = async (input: TIn) => {
        const impl = (declared as any).implementation;
        return impl
            ? impl(input)
            : reject({ diag: 'no-implementation' });
    };

    return declared as DeclaredAsyncParser<TIn, TOut>;
}

export function catchExceptionsAsync<In, Out>(parser: AsyncFullParser<In, Out>): AsyncFullParser<In, Out>;
export function catchExceptionsAsync<In, Out>(parser: AsyncParser<In, Out>): AsyncParser<In, Out>;
export function catchExceptionsAsync<In, Out>(parser: AsyncParser<In, Out>): AsyncParser<In, Out> {
    return async input => {
        try {
            const result = parser(input);
            return result;
        } catch (err) {
            return reject({ diag: 'exception', err });
        }
    };
}
