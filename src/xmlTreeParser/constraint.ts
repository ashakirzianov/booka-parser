type SimpleConstraint<TV, TC extends TV = TV> =
    | TC
    | ((x: TV) => boolean)
    | null
    | undefined
    ;
type CompoundConstraint<TV, TC extends TV = TV> = Array<SimpleConstraint<TV, TC>>;
export type Constraint<TV, TC extends TV = TV> =
    | SimpleConstraint<TV, TC>
    | CompoundConstraint<TV, TC>
    ;
export type ConstraintMap<T> = {
    [K in keyof T]: Constraint<T[K]> | undefined;
};
export type ConstrainedType<T, C extends ConstraintMap<T>> = {
    [k in keyof T]: C[k] extends Constraint<infer CV> ? CV : T[k];
};
export type ConstraintFailReason = {
    key: string,
    value: any,
    constraint: string,
};

function checkValueSimple<T, C extends T>(value: T | undefined, constraint: SimpleConstraint<T, C>): boolean {
    if (typeof constraint === 'function') {
        const fn = constraint as (x: T) => boolean;
        const result = value !== undefined && fn(value);
        return result;
    } else if (constraint === null) {
        return true;
    } else {
        return value === constraint;
    }
}

export function checkValue<T, C extends T>(value: T | undefined, constraint: Constraint<T, C>): boolean {
    if (Array.isArray(constraint)) {
        return constraint.some(c => checkValueSimple(value, c));
    } else {
        return checkValueSimple(value, constraint);
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
    for (const [key, c] of Object.entries(constraintMap)) {
        const constraint = c as Constraint<T[keyof T]>;
        const value = obj[key as keyof T];
        const result = checkValue(value, constraint);
        if (!result) {
            reasons.push({
                key: key,
                value: value,
                constraint: constraintToString(constraint),
            });
        }
    }

    return reasons;
}

export function checkObjectFull<T>(obj: T, constraintMap: ConstraintMap<T>): ConstraintFailReason[] {
    const reasons: ConstraintFailReason[] = checkObject(obj, constraintMap);
    for (const [key, value] of Object.entries(obj)) {
        const constraint = constraintMap[key as keyof T] as Constraint<T[keyof T]>;
        if (constraint === undefined) {
            reasons.push({
                key: key,
                value: value,
                constraint: 'should not be set',
            });
        }
    }

    return reasons;
}
