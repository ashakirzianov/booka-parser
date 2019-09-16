export type Severity =
    | 'error' | undefined // NOTE: treat undefined as 'error'
    | 'info'
    | 'warning'
    ;

export type EmptyParserDiagnostic = undefined;
export type ContextParserDiagnostic = {
    context: any,
    diagnostic: ParserDiagnostic,
};
export type CustomParserDiagnostic = {
    diag: string,
    severity?: Severity,
    [key: string]: any,
};

type SimpleDiagnostic =
    | ContextParserDiagnostic | CustomParserDiagnostic | EmptyParserDiagnostic;
type CompoundParserDiagnostic = SimpleDiagnostic[];

export type ParserDiagnostic = SimpleDiagnostic | SimpleDiagnostic[];

export function compoundDiagnostic(diags: ParserDiagnostic[]): ParserDiagnostic {
    const result = diags.reduce<SimpleDiagnostic[]>(
        (all, one) => {
            if (isCompoundDiagnostic(one)) {
                all.push(...one);
            } else if (one !== undefined) {
                all.push(one);
            }
            return all;
        },
        []);
    return result.length === 0 ? undefined
        : result.length === 1 ? result[0]
            : result;
}

export function topDiagnostic(diag: ParserDiagnostic, top: number): ParserDiagnostic {
    const flattened = flattenDiagnostic(diag);
    if (isCompoundDiagnostic(flattened)) {
        return flattened.slice(0, top);
    } else if (isContext(flattened)) {
        const inside = topDiagnostic(flattened.diagnostic, top);
        return inside && {
            ...flattened,
            diagnostic: flattenDiagnostic(flattened.diagnostic),
        };
    } else {
        return flattened;
    }
}

export function flattenDiagnostic(diag: ParserDiagnostic): ParserDiagnostic {
    if (isCompoundDiagnostic(diag)) {
        const inside = filterUndefined(diag.map(flattenDiagnostic));
        return inside.length === 0 ? undefined
            : inside.length === 1 ? inside[0]
                : inside as SimpleDiagnostic[];
    } else if (isContext(diag)) {
        const inside = flattenDiagnostic(diag.diagnostic);
        return inside && {
            ...diag,
            diagnostic: flattenDiagnostic(diag.diagnostic),
        };
    } else {
        return diag;
    }
}

export function isEmptyDiagnostic(diag: ParserDiagnostic): boolean {
    if (diag === undefined) {
        return true;
    } else if (isCompoundDiagnostic(diag)) {
        return diag.every(isEmptyDiagnostic);
    } else if (isContext(diag)) {
        return isEmptyDiagnostic(diag.diagnostic);
    } else {
        return diag.severity === 'info';
    }
}

export function isCompoundDiagnostic(d: ParserDiagnostic): d is CompoundParserDiagnostic {
    return Array.isArray(d);
}

function isContext(d: ParserDiagnostic): d is ContextParserDiagnostic {
    return d !== undefined && (d as any).context !== undefined;
}

function filterUndefined<T>(arr: Array<T | undefined>): T[] {
    return arr.filter((x): x is T => x !== undefined);
}
