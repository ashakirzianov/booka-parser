import { equalsToOneOf } from './utils';

export type Constraint<TV, TC extends TV = TV> =
    | TC
    | TC[]
    | ((x: TV) => boolean)
    | null
    ;
export type ConstraintMap<T> = {
    [K in keyof T]: Constraint<T[K]> | undefined;
};
export type ConstraintResult = {
    satisfy: true,
} | {
    satisfy: false,
    reason: ConstraintFailReason,
};
export type ConstraintFailReason = string[];
export type ConstrainedType<T, C extends ConstraintMap<T>> = {
    [k in keyof T]: C[k] extends Constraint<infer CV> ? CV : T[k];
};

export function checkValue<T, C extends T>(value: T, constraint: Constraint<T, C>): ConstraintResult {
    if (Array.isArray(constraint)) {
        if (equalsToOneOf(value, constraint)) {
            return { satisfy: true };
        } else {
            return {
                satisfy: false,
                reason: [`${value} is not one of [${constraint.join(', ')}]`],
            };
        }
    } else if (typeof constraint === 'function') {
        const fn = constraint as (x: T) => boolean;
        const result = fn(value);
        return result
            ? { satisfy: true }
            : { satisfy: false, reason: [`${value} does not satisfy function constraint`] };
    } else if (constraint === null) {
        return { satisfy: true };
    } else {
        return value === constraint
            ? { satisfy: true }
            : { satisfy: false, reason: [`${value} is not equal to ${constraint}`] };
    }
}

export function checkObject<T>(obj: T, constraintMap: ConstraintMap<T>): ConstraintResult {
    const reasons: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const constraint = constraintMap[key as keyof T] as Constraint<T[keyof T]>;
        if (constraint === undefined) {
            reasons.push(`Unexpected '${key} = ${value}'`);
        } else {
            const result = checkValue(value, constraint);
            if (!result.satisfy) {
                reasons.push(`${key} = ${value}: ${result.reason}`);
            }
        }
    }

    return reasons.length === 0
        ? { satisfy: true }
        : { satisfy: false, reason: reasons };
}