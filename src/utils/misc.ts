import { ResultNext, SuccessNext } from '../combinators';

// Returning Success<In, Out> is not perfect, but afaik there's no proper way of guarding Success type here
export function expectSuccess<In, Out>(result: ResultNext<In, Out>): result is SuccessNext<In, Out> {
    const success = result as SuccessNext<In, Out>;

    if (success.value === undefined || !success.success) {
        fail(`expected success, but got this instead: ${JSON.stringify(result)}`);
    }

    return success as any as true;
}

export function isWhitespaces(input: string): boolean {
    return input.match(/^\s*$/) ? true : false;
}

export function caseInsensitiveEq(left: string, right: string) {
    return left.localeCompare(right, undefined, { sensitivity: 'base' }) === 0;
}

export function equalsToOneOf<TX, TO extends TX>(x: TX, opts: TO[]): boolean {
    for (const o of opts) {
        if (x === o) {
            return true;
        }
    }
    return false;
}

export function last<T>(arr: T[]): T {
    return arr[arr.length - 1];
}

export function keys<T>(obj: T): Array<keyof T> {
    return Object.keys(obj) as any;
}

export function objectMap<T, U>(obj: T, f: <TK extends keyof T>(x: { key: TK, value: T[TK] }) => U): U[] {
    return keys(obj).map(key =>
        f({ key: key, value: obj[key] }));
}
