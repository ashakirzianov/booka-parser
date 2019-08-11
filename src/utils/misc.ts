import { Result, Success } from '../xml';

// Returning Success<In, Out> is not perfect, but afaik there's no proper way of guarding Success type here
export function expectSuccess<In, Out>(result: Result<In, Out>): result is Success<In, Out> {
    const success = result as Success<In, Out>;

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

export type TypeGuard<T, U extends T> = (x: T) => x is U;
export function typeGuard<T, U extends T>(f: (x: T) => boolean): TypeGuard<T, U> {
    return f as TypeGuard<T, U>;
}

export function forceType<T>(x: T): T {
    return x;
}

export function filterType<T, U extends T>(arr: T[], tg: TypeGuard<T, U>): U[] {
    return arr.filter(tg);
}

export function filterUndefined<T>(arr: Array<T | undefined>): T[] {
    return arr.filter(e => e !== undefined) as T[];
}

export function assertNever(x: never): never {
    throw new Error(`Should be never: ${x}`);
}

export function equalsToOneOf<TX, TO>(x: TX, ...opts: TO[]): boolean {
    return opts.reduce((res, o) =>
        res === true || o === (x as any), false as boolean);
}

export function keys<T>(obj: T): Array<keyof T> {
    return Object.keys(obj) as any;
}

export function objectMap<T, U>(obj: T, f: <TK extends keyof T>(x: { key: TK, value: T[TK] }) => U): U[] {
    return keys(obj).map(key =>
        f({ key: key, value: obj[key] }));
}

export function oneOf<T extends string | undefined>(...opts: T[]) {
    return (x: string | undefined): x is T => {
        return equalsToOneOf(x, ...opts);
    };
}

export function flatten<T>(arrArr: T[][]): T[] {
    return arrArr.reduce((acc, arr) => acc.concat(arr), []);
}

export function compose<T, U, V>(f: (x: T) => U, g: (x: U) => V): (x: T) => V {
    return x => g(f(x));
}

export function last<T>(arr: T[]): T {
    return arr[arr.length - 1];
}

export function addUnique<T>(arr: T[], value: T): T[] {
    if (arr.some(x => x === value)) {
        return arr;
    } else {
        return arr.concat([value]);
    }
}
