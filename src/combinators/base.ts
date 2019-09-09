import { ParserDiagnostic, compoundDiagnostic } from './diagnostics';

export type Parser<TIn, TOut> = (input: TIn) => Result<TIn, TOut>;
export type SuccessParser<TIn, TOut> = (input: TIn) => Success<TIn, TOut>;
export type Success<In, Out> = {
    value: Out,
    next: In,
    success: true,
    diagnostic: ParserDiagnostic,
};
export type Fail = {
    success: false,
    diagnostic: ParserDiagnostic,
};

export type Result<In, Out> = Success<In, Out> | Fail;

export function fail(reason: ParserDiagnostic): Fail {
    return { success: false, diagnostic: reason };
}

export function success<TIn, TOut>(value: TOut, next: TIn, diagnostic?: ParserDiagnostic): Success<TIn, TOut> {
    return {
        value, next,
        success: true,
        diagnostic: diagnostic || [],
    };
}

export function and<TI, T1, T2>(p1: Parser<TI, T1>, p2: Parser<TI, T2>): Parser<TI, [T1, T2]>;
export function and<TI, T1, T2, T3>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>): Parser<TI, [T1, T2, T3]>;
export function and<TI, T1, T2, T3, T4>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>, p4: Parser<TI, T4>): Parser<TI, [T1, T2, T3, T4]>;
export function and<TI, TS>(...ps: Array<Parser<TI, TS>>): Parser<TI, TS[]>;
export function and<T>(...ps: Array<Parser<T, any>>): Parser<T, any[]> {
    return input => {
        const results: any[] = [];
        const diagnostics: ParserDiagnostic[] = [];
        let lastInput = input;
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
        return success(results, lastInput, diagnostic);
    };
}

export function seq<TI, T1, T2>(p1: Parser<TI, T1>, p2: Parser<TI, T2>): Parser<TI, [T1, T2]>;
export function seq<TI, T1, T2, T3>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>): Parser<TI, [T1, T2, T3]>;
export function seq<TI, T1, T2, T3, T4>(p1: Parser<TI, T1>, p2: Parser<TI, T2>, p3: Parser<TI, T3>, p4: Parser<TI, T4>): Parser<TI, [T1, T2, T3, T4]>;
export function seq<TI, TS>(...ps: Array<Parser<TI, TS>>): Parser<TI, TS[]>;
export function seq<TI>(...ps: Array<Parser<TI, any>>): Parser<TI, any[]> {
    return input => {
        let currentInput = input;
        const results: any[] = [];
        const diagnostics: ParserDiagnostic[] = [];
        for (let i = 0; i < ps.length; i++) {
            const result = ps[i](currentInput);
            if (!result.success) {
                return result;
            }
            results.push(result.value);
            diagnostics.push(result.diagnostic);
            currentInput = result.next;
        }

        const diagnostic = compoundDiagnostic(diagnostics);
        return success(results, currentInput, diagnostic);
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
        const failReasons: ParserDiagnostic[] = [];
        for (let i = 0; i < ps.length; i++) {
            const result = ps[i](input);
            if (result.success) {
                return result;
            }
            failReasons.push(result.diagnostic);
        }

        return fail(compoundDiagnostic(failReasons));
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

export function some<TI, T>(parser: Parser<TI, T>): SuccessParser<TI, T[]> {
    return input => {
        const results: T[] = [];
        const diagnostics: ParserDiagnostic[] = [];
        let currentInput = input;
        let currentResult: Result<TI, T>;
        do {
            currentResult = parser(currentInput);
            if (currentResult.success) {
                results.push(currentResult.value);
                diagnostics.push(currentResult.diagnostic);
                currentInput = currentResult.next;
            }
        } while (currentResult.success);

        const diagnostic = compoundDiagnostic(diagnostics);
        return success(results, currentInput, diagnostic);
    };
}

export function maybe<TIn, TOut>(parser: Parser<TIn, TOut>): SuccessParser<TIn, TOut | undefined> {
    return input => {
        const result = parser(input);
        return result.success
            ? result
            : success(undefined, input);
    };
}

// TODO: implement proper reason reporting
export function oneOrMore<TI, T>(parser: Parser<TI, T>): Parser<TI, T[]> {
    return guard(some(parser), nodes => nodes.length > 0);
}

export function guard<TI, TO>(parser: Parser<TI, TO>, f: (x: TO) => boolean): Parser<TI, TO> {
    return input => {
        const result = parser(input);
        if (result.success) {
            const guarded = f(result.value);
            return guarded
                ? result
                : fail({ diag: 'guard: failed' });
        } else {
            return result;
        }
    };
}

export function translate<TI, From, To>(parser: SuccessParser<TI, From>, f: (from: From) => To): SuccessParser<TI, To>;
export function translate<TI, From, To>(parser: Parser<TI, From>, f: (from: From) => To | null): Parser<TI, To>;
export function translate<TI, From, To>(parser: Parser<TI, From>, f: (from: From) => To): Parser<TI, To> {
    return input => {
        const from = parser(input);
        if (from.success) {
            const translated = f(from.value);
            return success(translated, from.next, from.diagnostic);
        } else {
            return from;
        }
    };
}

type WarnFnPair<T> = {
    diagnostic: ParserDiagnostic,
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
            return fail({ diag: 'translate: result rejected by transform function' });
        } else if (isWarnPair(translated)) {
            return success(translated.result, from.next, compoundDiagnostic([translated.diagnostic, from.diagnostic]));
        } else {
            return success(translated, from.next, from.diagnostic);
        }
    };
}

export function reparse<T, U, V>(parser: Parser<T, U>, reparser: Parser<U, V>): Parser<T, V> {
    return input => {
        const result = parser(input);

        if (result.success) {
            const reresult = reparser(result.value);
            // TODO: add diagnostic from result
            if (reresult.success) {
                return success(
                    reresult.value,
                    result.next,
                    compoundDiagnostic([result.diagnostic, reresult.diagnostic]),
                );
            } else {
                return reresult;
            }
        } else {
            return result;
        }
    };
}

export type DeclaredParser<TIn, TOut> = {
    (input: TIn): Result<TIn, TOut>,
    implementation: (input: TIn) => Result<TIn, TOut>,
};
export function declare<TIn, TOut>(): DeclaredParser<TIn, TOut> {
    const declared = (input: TIn) => {
        // TODO: consider throw in no implementation provided
        return (declared as any).implementation(input);
    };

    return declared as DeclaredParser<TIn, TOut>;
}

type DiagnosticOrFn<TOut> = ParserDiagnostic | ((x: TOut) => ParserDiagnostic);
function getDiagnostic<TOut>(result: Result<any, TOut>, mOrF: DiagnosticOrFn<TOut>) {
    return typeof mOrF === 'function'
        ? (result.success ? mOrF(result.value) : undefined)
        : mOrF;
}

export function expected<TI, TO>(parser: Parser<TI, TO>): SuccessParser<TI, TO | undefined> {
    return input => {
        const result = parser(input);
        return result.success
            ? result
            : success(undefined, input, result.diagnostic);
    };
}

export function unexpected<T>(mOrF: ParserDiagnostic | ((x: T) => ParserDiagnostic)) {
    return expected(failed<T>(mOrF));
}

export function failed<T>(mOrF: ParserDiagnostic | ((x: T) => ParserDiagnostic)): Parser<T, undefined> {
    if (typeof mOrF === 'function') {
        return input => fail(mOrF(input));
    } else {
        return () => fail(mOrF);
    }
}

export function tagged<TIn, TOut>(parser: Parser<TIn, TOut>, f: (x: TIn) => string): Parser<TIn, TOut> {
    return input => {
        const result = parser(input);
        return result.success
            ? result
            : fail({
                diag: 'tag',
                inside: result.diagnostic,
                tag: f(input),
            });
    };
}

export function yieldOne<In, Out>(f: (x: In) => Out): Parser<In, Out> {
    return input => success(f(input), input);
}
