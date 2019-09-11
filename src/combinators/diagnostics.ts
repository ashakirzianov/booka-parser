import { filterUndefined } from '../utils';

export type Severity =
    | 'error' | undefined // NOTE: treat undefined as 'error'
    | 'info'
    | 'warning'
    ;

export type EmptyParserDiagnostic = undefined;
export type BasicParserDiagnostic =
    | 'guard-failed' | 'translate-reject' | 'empty-input'
    | 'empty-stream' | 'reject-head' | 'expected-end' | 'not-parser-succ'
    ;
export type CompoundParserDiagnostic = {
    diagnostics: ParserDiagnostic[],
};
export type ContextParserDiagnostic = {
    context: any,
    diagnostic: ParserDiagnostic,
};
export type CustomParserDiagnostic = {
    custom: string,
    severity?: Severity,
    [key: string]: any,
};

export type ParserDiagnostic =
    | BasicParserDiagnostic | CompoundParserDiagnostic | ContextParserDiagnostic
    | CustomParserDiagnostic | EmptyParserDiagnostic;

export function compoundDiagnostic(diags: ParserDiagnostic[]): ParserDiagnostic {
    const result = filterUndefined(diags);
    return result.length === 0 ? undefined
        : result.length === 1 ? result[0]
            : { diagnostics: diags };
}

export function isEmptyDiagnostic(diag: ParserDiagnostic): boolean {
    if (diag === undefined) {
        return true;
    } else if (typeof diag === 'string') {
        return false;
    } else if (isCompound(diag)) {
        return diag.diagnostics.every(isEmptyDiagnostic);
    } else if (isContext(diag)) {
        return isEmptyDiagnostic(diag.diagnostic);
    } else {
        return diag.severity === 'info';
    }
}

function isCompound(d: ParserDiagnostic): d is CompoundParserDiagnostic {
    return (d as any).diagnostics !== undefined;
}

function isContext(d: ParserDiagnostic): d is ContextParserDiagnostic {
    return (d as any).context !== undefined;
}
