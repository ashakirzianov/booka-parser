import { Diagnostic, compoundDiagnostic } from './diagnostics';

export type Parser<TIn, TOut> = (input: TIn) => ResultNext<TIn, TOut>;
export type FullParser<In, Out> = (input: In) => Success<Out> | Fail;
export type SuccessParser<TIn, TOut> = (input: TIn) => SuccessNext<TIn, TOut>;
export type Success<Out> = {
    success: true,
    value: Out,
    diagnostic?: Diagnostic,
};
export type SuccessNext<In, Out> = Success<Out> & {
    next?: In,
};
export type Fail = {
    success: false,
    diagnostic?: Diagnostic,
};

export type ResultNext<In, Out> = SuccessNext<In, Out> | Fail;
export type Result<Out> = Success<Out> | Fail;

export function failure(reason?: Diagnostic): Fail {
    return { success: false, diagnostic: reason };
}

export function success<Out>(value: Out, diagnostic?: Diagnostic): Success<Out> {
    return {
        success: true,
        value, diagnostic,
    };
}

export function yieldNext<TIn, TOut>(value: TOut, next: TIn, diagnostic?: Diagnostic): SuccessNext<TIn, TOut> {
    return {
        value, next, diagnostic,
        success: true,
    };
}

export function compoundResult<T>(results: Array<Success<T>>): Success<T[]> {
    const value = results.map(r => r.value);
    const diag = compoundDiagnostic(results.map(r => r.diagnostic));
    return success(value, diag);
}

export function projectResult<Out, P>(result: Success<Out>, fn: (x: Out) => P): Success<P>;
export function projectResult<In, Out, P>(result: SuccessNext<In, Out>, fn: (x: Out) => P): SuccessNext<In, P>;
export function projectResult<In, Out, P>(result: ResultNext<In, Out>, fn: (x: Out) => P): ResultNext<In, P>;
export function projectResult<In, Out, P>(result: ResultNext<In, Out>, fn: (x: Out) => P): ResultNext<In, P> {
    return result.success
        ? { ...result, value: fn(result.value) }
        : result;
}

export function and<TI, T1, T2>(p1: Parser<TI, T1>, p2: Parser<TI, T2>): Parser<TI, [T1, T2]>;
export function and<TI, T1, T2, T3>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>): Parser<TI, [T1, T2, T3]>;
export function and<TI, T1, T2, T3, T4>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>, p4: Parser<TI, T4>): Parser<TI, [T1, T2, T3, T4]>;
export function and<TI, TS>(...ps: Array<Parser<TI, TS>>): Parser<TI, TS[]>;
export function and<T>(...ps: Array<Parser<T, any>>): Parser<T, any[]> {
    return input => {
        const results: any[] = [];
        const diagnostics: Diagnostic[] = [];
        let lastInput: T | undefined = input;
        for (let i = 0; i < ps.length; i++) {
            const result = ps[i](input);
            if (!result.success) {
                return result;
            }
            results.push(result.value);
            diagnostics.push(result.diagnostic);
            lastInput = result.next;
        }

        const diagnostic = compoundDiagnostic(diagnostics);
        return yieldNext(results, lastInput, diagnostic);
    };
}

export function seq<TI, T1, T2>(p1: Parser<TI, T1>, p2: Parser<TI, T2>): Parser<TI, [T1, T2]>;
export function seq<TI, T1, T2, T3>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>): Parser<TI, [T1, T2, T3]>;
export function seq<TI, T1, T2, T3, T4>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>, p4: Parser<TI, T4>): Parser<TI, [T1, T2, T3, T4]>;
export function seq<TI, TS>(...ps: Array<Parser<TI, TS>>): Parser<TI, TS[]>;
export function seq<TI>(...ps: Array<Parser<TI, any>>): Parser<TI, any[]> {
    return input => {
        let currentInput: TI | undefined = input;
        const results: any[] = [];
        const diagnostics: Diagnostic[] = [];
        for (let i = 0; i < ps.length; i++) {
            if (currentInput === undefined) {
                return failure();
            }
            const result = ps[i](currentInput);
            if (!result.success) {
                return result;
            }
            results.push(result.value);
            diagnostics.push(result.diagnostic);
            currentInput = result.next;
        }

        const diagnostic = compoundDiagnostic(diagnostics);
        return yieldNext(results, currentInput, diagnostic);
    };
}

export function choice<TI, T1, T2>(p1: Parser<TI, T1>, p2: Parser<TI, T2>): Parser<TI, T1 | T2>;
export function choice<TI, T1, T2, T3>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>): Parser<TI, T1 | T2 | T3>;
export function choice<TI, T1, T2, T3, T4>(
    p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>, p4: Parser<TI, T4>
): Parser<TI, T1 | T2 | T3 | T4>;
export function choice<TI, T1, T2, T3, T4, T5>(
    p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>,
    p4: Parser<TI, T4>, p5: Parser<TI, T5>,
): Parser<TI, T1 | T2 | T3 | T4 | T5>;
export function choice<TI, TS>(...ps: Array<Parser<TI, TS>>): Parser<TI, TS>;
export function choice<TI>(...ps: Array<Parser<TI, any>>): Parser<TI, any> {
    return input => {
        const failReasons: Diagnostic[] = [];
        for (let i = 0; i < ps.length; i++) {
            const result = ps[i](input);
            if (result.success) {
                return result;
            }
            failReasons.push(result.diagnostic);
        }

        return failure(compoundDiagnostic(failReasons));
    };
}

export function projectLast<TI, T1, T2>(parser: Parser<TI, [T1, T2]>): Parser<TI, T2>;
export function projectLast<TI, T1, T2, T3>(parser: Parser<TI, [T1, T2, T3]>): Parser<TI, T3>;
export function projectLast<TI, T>(parser: Parser<TI, T[]>): Parser<TI, T>;
export function projectLast<TI>(parser: Parser<TI, any>): Parser<TI, any> {
    return translate(parser, result => result[result.length - 1]);
}

export function projectFirst<TI, T1, T2>(parser: Parser<TI, [T1, T2]>): Parser<TI, T1>;
export function projectFirst<TI, T>(parser: Parser<TI, T[]>): Parser<TI, T>;
export function projectFirst<TI>(parser: Parser<TI, any[]>): Parser<TI, any> {
    return translate(parser, result => result[0]);
}

export function some<In, Out>(parser: Parser<In, Out>): SuccessParser<In, Out[]> {
    return input => {
        const results: Out[] = [];
        const diagnostics: Diagnostic[] = [];
        let currentInput: In | undefined = input;
        let currentResult: ResultNext<In, Out>;
        do {
            if (currentInput === undefined) {
                break;
            }
            currentResult = parser(currentInput);
            if (currentResult.success) {
                results.push(currentResult.value);
                diagnostics.push(currentResult.diagnostic);
                currentInput = currentResult.next;
            }
        } while (currentResult.success);

        const diagnostic = compoundDiagnostic(diagnostics);
        return yieldNext(results, currentInput, diagnostic);
    };
}

export function maybe<TIn, TOut>(parser: Parser<TIn, TOut>): SuccessParser<TIn, TOut | undefined> {
    return input => {
        const result = parser(input);
        return result.success
            ? result
            : yieldNext(undefined, input);
    };
}

export function oneOrMore<TI, T>(parser: Parser<TI, T>): Parser<TI, T[]> {
    const someParser = some(parser);
    return input => {
        const result = someParser(input);
        if (result.value.length > 0) {
            return result;
        } else {
            return failure();
        }
    };
}

export function guard<TI, TO>(parser: Parser<TI, TO>, f: (x: TO) => boolean): Parser<TI, TO> {
    return input => {
        const result = parser(input);
        if (result.success) {
            const guarded = f(result.value);
            return guarded
                ? result
                : failure(result.diagnostic);
        } else {
            return result;
        }
    };
}

export function translate<TI, From, To>(parser: SuccessParser<TI, From>, f: (from: From, input: TI) => To): SuccessParser<TI, To>;
export function translate<TI, From, To>(parser: Parser<TI, From>, f: (from: From, input: TI) => To | null): Parser<TI, To>;
export function translate<TI, From, To>(parser: Parser<TI, From>, f: (from: From, input: TI) => To): Parser<TI, To> {
    return input => {
        const from = parser(input);
        if (from.success) {
            const translated = f(from.value, input);
            return yieldNext(translated, from.next, from.diagnostic);
        } else {
            return from;
        }
    };
}

type WarnFnPair<T> = {
    diagnostic: Diagnostic,
    result: T,
};
type WarnFnResult<To> = To | WarnFnPair<To> | null;
export type WarnFn<From, To> = (x: From) => WarnFnResult<To>;
export function isWarnPair<To>(x: WarnFnResult<To>): x is WarnFnPair<To> {
    return x !== null && (x as any)['diagnostic'] !== undefined;
}
export function translateAndWarn<TI, From, To>(parser: Parser<TI, From>, f: WarnFn<From, To>): Parser<TI, To> {
    return input => {
        const from = parser(input);
        if (!from.success) {
            return from;
        }

        const translated = f(from.value);
        if (translated === null) {
            return failure();
        } else if (isWarnPair(translated)) {
            return yieldNext(translated.result, from.next, compoundDiagnostic([translated.diagnostic, from.diagnostic]));
        } else {
            return yieldNext(translated, from.next, from.diagnostic);
        }
    };
}

export type DeclaredParser<TIn, TOut> = {
    (input: TIn): ResultNext<TIn, TOut>,
    implementation: Parser<TIn, TOut>,
    displayName?: string,
};
export function declare<TIn, TOut>(name?: string): DeclaredParser<TIn, TOut> {
    const declared = ((input: TIn) => {
        const impl = (declared as any).implementation;
        return impl
            ? impl(input)
            : failure({ diag: 'no-implementation' });
    }) as DeclaredParser<TIn, TOut>;
    declared.displayName = name;

    return declared;
}

export function expected<TI, TO>(parser: Parser<TI, TO>, value: TO, diagFn?: (i: TI) => Diagnostic): SuccessParser<TI, TO> {
    return input => {
        const result = parser(input);
        return result.success
            ? result
            : yieldNext(
                value,
                input,
                compoundDiagnostic([result.diagnostic, diagFn && diagFn(input)]),
            );
    };
}

export function unexpected<T>(mOrF: Diagnostic | ((x: T) => Diagnostic)) {
    return expected(failed<T>(mOrF), undefined);
}

export function failed<T>(mOrF: Diagnostic | ((x: T) => Diagnostic)): Parser<T, undefined> {
    if (typeof mOrF === 'function') {
        return input => failure(mOrF(input));
    } else {
        return () => failure(mOrF);
    }
}

export function alwaysYield<In, Out>(f: (x: In) => Out): Parser<In, Out> {
    return input => yieldNext(f(input), input);
}

export function expectEnd<In, Out>(parser: Parser<In, Out>): FullParser<In, Out> {
    return input => {
        const result = parser(input);

        if (!result.success) {
            return result;
        }

        return result.next === undefined
            ? result
            : {
                ...result,
                next: undefined,
            };
    };
}

export function namedParser<In, Out>(name: string, parser: Parser<In, Out>): Parser<In, Out> {
    const result: Parser<In, Out> = named => parser(named);
    (result as any).displayName = name;
    return result;
}

export function pipe<T1, T2, TR>(p1: FullParser<T1, T2>, p2: FullParser<T2, TR>): FullParser<T1, TR>;
export function pipe<T1, T2, T3, TR>(
    p1: FullParser<T1, T2>,
    p2: FullParser<T2, T3>,
    p3: FullParser<T3, TR>
): FullParser<T1, TR>;
export function pipe(...ps: Array<FullParser<any, any>>): FullParser<any, any> {
    return input => {
        const diags: Diagnostic[] = [];
        let currInput = input;
        let r: any = undefined;
        for (const p of ps) {
            r = p(currInput);
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
