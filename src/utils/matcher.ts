type SimpleMatcher<Value, C extends Value = Value> =
    | C
    | ((x: Value | undefined) => boolean)
    | null
    | undefined
    ;
type CompoundMatcher<Value, C extends Value = Value> = Array<SimpleMatcher<Value, C>>;
export type ValueMatcher<Value, C extends Value = Value> =
    | SimpleMatcher<Value, C>
    | CompoundMatcher<Value, C>
    ;
export type ObjectMatcher<T> = {
    [K in keyof T]: ValueMatcher<T[K]> | undefined;
};
export type ValueMatchResult = boolean;

function matchValueSimple<T, C extends T>(value: T | undefined, matcher: SimpleMatcher<T, C>): ValueMatchResult {
    if (typeof matcher === 'function') {
        const fn = matcher as (x: T | undefined) => boolean;
        const result = fn(value);
        return result;
    } else if (matcher === null) {
        return true;
    } else {
        return value === matcher;
    }
}

export function checkValue<T, C extends T>(value: T | undefined, constraint: ValueMatcher<T, C>): boolean {
    if (Array.isArray(constraint)) {
        return constraint.some(c => matchValueSimple(value, c));
    } else {
        return matchValueSimple(value, constraint);
    }
}

export function matcherToString<T>(matcher: ValueMatcher<T>): string {
    if (Array.isArray(matcher)) {
        return `[${matcher.join(', ')}]`;
    } else if (typeof matcher === 'function') {
        return 'fn';
    } else if (matcher === null) {
        return '<any>';
    } else {
        return JSON.stringify(matcher);
    }
}

export type ObjectMatchResult = {
    [k: string]: {
        value: any,
        reason: 'failed' | 'unexpected',
    };
};
export function matchObject<T>(obj: T, constraintMap: ObjectMatcher<T>): ObjectMatchResult {
    const result: ObjectMatchResult = {};
    for (const [key, c] of Object.entries(constraintMap)) {
        const constraint = c as ValueMatcher<T[keyof T]>;
        const value = obj[key as keyof T];
        const valueResult = checkValue(value, constraint);
        if (!valueResult) {
            result[key] = {
                value, reason: 'failed',
            };
        }
    }
    for (const [key, value] of Object.entries(obj)) {
        const constraint = constraintMap[key as keyof T];
        if (constraint === undefined) {
            result[key] = {
                value, reason: 'unexpected',
            };
        }
    }

    return result;
}

export function failedKeys(match: ObjectMatchResult): Array<ObjectMatchResult[string]> {
    return Object
        .keys(match).filter(k => match[k].reason === 'failed')
        .map(k => match[k]);
}

export function unexpectedKeys(match: ObjectMatchResult): Array<ObjectMatchResult[string]> {
    return Object
        .keys(match).filter(k => match[k].reason === 'unexpected')
        .map(k => match[k]);
}
