export type Severity =
    | 'error' | undefined // NOTE: treat undefined as 'error'
    | 'info'
    | 'warning'
    ;

export type EmptyDiagnostic = undefined;
export type CustomDiagnostic = {
    diag: string,
    severity?: Severity,
    [key: string]: any,
};

type SimpleDiagnostic =
    | CustomDiagnostic | EmptyDiagnostic;
type CompoundDiagnostic = SimpleDiagnostic[];

export type Diagnostic = SimpleDiagnostic | CompoundDiagnostic;

export function getErrors(diag: Diagnostic): Diagnostic {
    if (diag === undefined) {
        return diag;
    } else if (isCompoundDiagnostic(diag)) {
        return compoundDiagnostic(diag.map(getErrors));
    } else {
        return diag.severity === 'error' || diag.severity === undefined
            ? diag
            : undefined;
    }
}

export function compoundDiagnostic(diags: Diagnostic[]): Diagnostic {
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

export function topDiagnostic(diag: Diagnostic, top: number): Diagnostic {
    const flattened = flattenDiagnostic(diag);
    if (isCompoundDiagnostic(flattened)) {
        return flattened.slice(0, top);
    } else {
        return flattened;
    }
}

export function flattenDiagnostic(diag: Diagnostic): Diagnostic {
    if (isCompoundDiagnostic(diag)) {
        const inside = filterUndefined(diag.map(flattenDiagnostic));
        return inside.length === 0 ? undefined
            : inside.length === 1 ? inside[0]
                : inside as SimpleDiagnostic[];
    } else {
        return diag;
    }
}

export function isEmptyDiagnostic(diag: Diagnostic): boolean {
    if (diag === undefined) {
        return true;
    } else if (isCompoundDiagnostic(diag)) {
        return diag.every(isEmptyDiagnostic);
    } else {
        return diag.severity === 'info';
    }
}

export function isCompoundDiagnostic(d: Diagnostic): d is CompoundDiagnostic {
    return Array.isArray(d);
}

function filterUndefined<T>(arr: Array<T | undefined>): T[] {
    return arr.filter((x): x is T => x !== undefined);
}
