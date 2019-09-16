import { equalsToOneOf } from '../utils';

export type Constraint<TV, TC extends TV = TV> =
    | TC
    | TC[]
    | ((x: TV) => boolean)
    | null
    ;
export type ConstraintMap<T> = {
    [K in keyof T]: Constraint<T[K]> | undefined;
};
export type ConstrainedType<T, C extends ConstraintMap<T>> = {
    [k in keyof T]: C[k] extends Constraint<infer CV> ? CV : T[k];
};
export type ConstraintFailReason = {
    key: string,
    value: string,
    constraint: string,
};

export function checkValue<T, C extends T>(value: T, constraint: Constraint<T, C>): boolean {
    if (Array.isArray(constraint)) {
        return equalsToOneOf(value, constraint);
    } else if (typeof constraint === 'function') {
        const fn = constraint as (x: T) => boolean;
        const result = fn(value);
        return result;
    } else if (constraint === null) {
        return true;
    } else {
        return value === constraint;
    }
}

export function constraintToString<T>(constraint: Constraint<T>): string {
    if (Array.isArray(constraint)) {
        return `[${constraint.join(', ')}]`;
    } else if (typeof constraint === 'function') {
        return 'fn';
    } else if (constraint === null) {
        return '<any>';
    } else {
        return JSON.stringify(constraint);
    }
}

export function checkObject<T>(obj: T, constraintMap: ConstraintMap<T>): ConstraintFailReason[] {
    const reasons: ConstraintFailReason[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const constraint = constraintMap[key as keyof T] as Constraint<T[keyof T]>;
        if (constraint === undefined) {
            reasons.push({
                key: key,
                value: value,
                constraint: 'should not be set',
            });
        } else {
            const result = checkValue(value, constraint);
            if (!result) {
                reasons.push({
                    key: key,
                    value: value,
                    constraint: constraintToString(constraint),
                });
            }
        }
    }

    return reasons;
}