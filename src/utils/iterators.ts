export type IterType<T> = IterableIterator<T>;

export const Iter = {
    toIterator: toIterator,
    toArray: toArray,
    map: mapIter,
    filter: filterIter,
    flatten: flattenIter,
};

function* flattenIter<T>(iterIter: IterType<IterType<T>>): IterType<T> {
    for (const i of iterIter) {
        yield* i;
    }
}

function* mapIter<T, U>(iter: IterType<T>, f: (x: T) => U): IterType<U> {
    for (const i of iter) {
        yield f(i);
    }
}

function* filterIter<T>(iter: IterType<T>, f: (x: T) => boolean): IterType<T> {
    for (const i of iter) {
        if (f(i)) {
            yield i;
        }
    }
}

function* toIterator<T>(arr: T[]): IterableIterator<T> {
    yield* arr;
}

function toArray<T>(iter: Iterator<T>): T[] {
    const result: T[] = [];
    let next = iter.next();
    while (!next.done) {
        result.push(next.value);
        next = iter.next();
    }

    return result;
}
