import { Parser, Result } from './base';

export type AsyncParser<I, O> = (input: I) => Promise<Result<I, O>>;
