import {
    Parser, success, fail, seq, some, projectLast, Message, compoundMessage, and,
} from './parserCombinators';
import { Predicate, andPred } from './predicate';

export type ArrayParser<TIn, TOut = TIn> = Parser<TIn[], TOut>;

export function headParser<TIn>() {
    return <TOut>(f: (n: TIn) => TOut | null) => (input: TIn[]) => {
        const head = input[0];
        if (head === undefined) {
            return fail('first node: empty input');
        }
        const result = f(head);
        return result === null
            ? fail('first node: func returned null')
            : success(result, input.slice(1))
            ;
    };
}

export function end<T = any>(): ArrayParser<T, undefined> {
    return input => input.length === 0
        ? success(undefined, input)
        : fail(`Expected end of input, got: '${input}`);
}

export function not<T>(parser: ArrayParser<T, any>): ArrayParser<T, T> {
    return input => {
        const head = input[0];
        if (head === undefined) {
            return fail('not: empty input');
        }

        const result = parser(input);
        return !result.success
            ? success(head, input.slice(1))
            : fail('not: parser succeed');
    };
}

export function skipTo<TI, TO>(parser: ArrayParser<TI, TO>): ArrayParser<TI, TO> {
    return projectLast(seq(
        some(not(parser)),
        parser,
    ));
}

export const anyItem = headParser()(x => x);

export function predicate<TI, TO>(pred: Predicate<TI, TO>): ArrayParser<TI, TO> {
    return (input: TI[]) => {
        const head = input[0];
        if (!head) {
            return fail('pred: empty input');
        }

        const result = pred(head);
        if (result.success) {
            return success(result.value, input.slice(1), result.message);
        } else {
            return fail(result.message);
        }
    };
}
