import { Result } from './base';
import { Stream } from './stream';

export type AsyncParser<I, O> = (input: I) => Promise<Result<I, O>>;
export type AsyncStreamParser<I, O, E> = AsyncParser<Stream<I, E>, O>;
