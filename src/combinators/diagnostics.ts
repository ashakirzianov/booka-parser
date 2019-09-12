import { filterUndefined } from '../utils';

export type Severity =
    | 'error' | undefined // NOTE: treat undefined as 'error'
    | 'info'
    | 'warning'
    ;

export type EmptyParserDiagnostic = undefined;
export type CompoundParserDiagnostic = {
    diagnostics: ParserDiagnostic[],
};
export type ContextParserDiagnostic = {
    context: any,
    diagnostic: ParserDiagnostic,
};
export type CustomParserDiagnostic = {
    diag: string,
    severity?: Severity,
    [key: string]: any,
};

export type ParserDiagnostic =
    | CompoundParserDiagnostic | ContextParserDiagnostic
    | CustomParserDiagnostic | EmptyParserDiagnostic;

export function compoundDiagnostic(diags: ParserDiagnostic[]): ParserDiagnostic {
    const result = filterUndefined(diags);
    return result.length === 0 ? undefined
        : result.length === 1 ? result[0]
            : { diagnostics: result };
}

export function topDiagnostic(diag: ParserDiagnostic, top: number): ParserDiagnostic {
    const flattened = flattenDiagnostic(diag);
    if (isCompound(flattened)) {
        return {
            ...flattened,
            diagnostics: flattened.diagnostics.slice(0, top),
        };
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
    if (isCompound(diag)) {
        const inside = filterUndefined(diag.diagnostics.map(flattenDiagnostic));
        return inside.length === 0 ? undefined
            : inside.length === 1 ? inside[0]
                : { ...diag, diagnostics: inside };
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
    } else if (isCompound(diag)) {
        return diag.diagnostics.every(isEmptyDiagnostic);
    } else if (isContext(diag)) {
        return isEmptyDiagnostic(diag.diagnostic);
    } else {
        return diag.severity === 'info';
    }
}

function isCompound(d: ParserDiagnostic): d is CompoundParserDiagnostic {
    return d !== undefined && (d as any).diagnostics !== undefined;
}

function isContext(d: ParserDiagnostic): d is ContextParserDiagnostic {
    return d !== undefined && (d as any).context !== undefined;
}
