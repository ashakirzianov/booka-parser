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
