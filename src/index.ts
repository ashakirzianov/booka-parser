export {
    ResultNext as Result, Result as ResultLast,
    isCompoundDiagnostic, isEmptyDiagnostic, Diagnostic,
    getErrors, getNonErrors, compoundDiagnostic,
} from './combinators';
export * from './epub';

export const parserVersion = '1.1.2';
