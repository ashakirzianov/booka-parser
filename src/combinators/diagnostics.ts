export type Severity =
    | 'error' | undefined // NOTE: treat undefined as 'error'
    | 'info'
    | 'warning'
    ;

export type ParserSimpleDiagnostic = {
    diag: string,
    severity?: Severity,
    [key: string]: any, // TODO: rethink
};

export type ParserDiagnostic =
    | ParserSimpleDiagnostic | ParserSimpleDiagnostic[];

export function compoundDiagnostic(diags: ParserDiagnostic[]): ParserDiagnostic {
    return {
        diag: 'compound',
        diagnostics: diags,
    };
}
