import { Message, compoundMessage } from './parserCombinators';
import { equalsToOneOf, keys } from '../utils';

export type PredicateResultSuccess<T> = {
    success: true,
    message: Message,
    value: T,
};
export type PredicateResultFail = {
    success: false,
    message: Message,
};
export type PredicateResult<T> = PredicateResultSuccess<T> | PredicateResultFail;
export function predSucc<T>(value: T, message?: Message): PredicateResultSuccess<T> {
    return {
        success: true,
        value, message,
    };
}
export function predFail(message: Message): PredicateResultFail {
    return {
        success: false,
        message,
    };
}

export type Predicate<TI, TO = TI> = (x: TI) => PredicateResult<TI & TO>;

export type ConstraintValue<TV> = TV | TV[] | ((x: TV) => boolean);
export type Constraint<T, TK extends keyof T, TV extends T[TK]> = {
    key: TK,
    value: ConstraintValue<TV>,
};
export function keyValuePred<T>() {
    return <TK extends keyof T, TV extends T[TK]>(c: Constraint<T, TK, TV>): Predicate<T, { [k in TK]: T[TK] }> => {
        if (Array.isArray(c.value)) {
            const arr = c.value;
            return (input: any) => {
                const inspected: any = input !== undefined ? input[c.key] : undefined;
                return equalsToOneOf(inspected, ...arr)
                    ? predSucc(input)
                    : predFail(`'${input}.${c.key}=${inspected}', expected to be one of [${c.value}]`);
            };
        } else if (typeof c.value === 'function') {
            const value = c.value as (x: TV) => boolean;
            return (input: any) => {
                const inspected: any = input !== undefined ? input[c.key] : undefined;
                const result = value(inspected);
                return result
                    ? predSucc(input)
                    : predFail(`Unexpected ${input}.${c.key}=${inspected}`);
            };
        } else {
            return (input: any) => {
                const inspected: any = input !== undefined ? input[c.key] : undefined;
                return inspected === c.value
                    ? predSucc(input)
                    : predFail(`'${input}.${c.key}=${inspected}', expected to be '${c.value}'`);
            };
        }
    };
}

export type ConstraintMap<T> = {
    [K in keyof T]: Constraint<T, K, T[K]>
};
export function mapPredicate<T>(map: ConstraintMap<T>) {
    const kvp = keyValuePred<T>();
    const constraints = keys(map)
        .map(key => {
            const value = map[key];
            return kvp({ key: key, value: value as any });
        });

    return andPred(...constraints);
}

export function andPred<TI, T>(
    ...preds: Array<Predicate<TI, T>>
): Predicate<TI, T>;

export function andPred<TI, T1, T2>(
    p1: Predicate<TI, T1>, ...p2: Array<Predicate<TI & T1, T2>>
): Predicate<TI, T1 & T2>;

export function andPred<TI, T1, T2, T3>(
    p1: Predicate<TI, T1>, p2: Predicate<TI & T1, T2>, ...p3: Array<Predicate<TI & T1 & T2, T3>>
): Predicate<TI, T1 & T2 & T3>;

export function andPred<TI>(...preds: Array<Predicate<TI, any>>): Predicate<TI, any> {
    if (preds.length === 0) {
        return truePred;
    }
    return (input: TI) => {
        const messages: Message[] = [];
        for (const p of preds) {
            const result = p(input);
            if (!result.success) {
                return predFail(result.message);
            } else {
                messages.push(result.message);
            }
        }

        return predSucc(input, compoundMessage(messages));
    };
}

export function expectPred<TI>(pred: Predicate<TI, any>): Predicate<TI> {
    return i => {
        const result = pred(i);
        return result.success
            ? result
            : predSucc(i, result.message);
    };
}

export function truePred<T>(x: T): PredicateResultSuccess<T> {
    return predSucc(x);
}
