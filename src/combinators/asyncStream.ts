import { AsyncParser } from './async';
import { Stream, nextStream } from './stream';
import { reject, ResultLast } from './base';

export type AsyncStreamParser<I, O, E = undefined> = AsyncParser<Stream<I, E>, O>;

export type AsyncHeadFn<In, Out, Env> = (head: In, env: Env) => Promise<ResultLast<Out>>;
export function headParserAsync<In, Out, Env = any>(f: AsyncHeadFn<In, Out, Env>): AsyncStreamParser<In, Out, Env> {
    return async (input: Stream<In, Env>) => {
        const head = input.stream[0];
        if (head === undefined) {
            return reject();
        }
        const result = await f(head, input.env);
        return result.success
            ? {
                ...result,
                next: nextStream(input),
            }
            : result;
    };
}
