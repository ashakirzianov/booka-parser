// TODO: check why TypeScript type inference doesn't work properly
// if we use AsyncIterator<AsyncIterator<T>>
export type AsyncIterType<T> = AsyncIterableIterator<T>;

export const AsyncIter = {
    toIterator: toAsyncIterator,
    toArray: toAsyncArray,
    map: mapAsyncIterator,
    filter: filterAsyncIter,
    flatten: flattenAsyncIterator,
};

async function* flattenAsyncIterator<T>(iterIter: AsyncIterableIterator<AsyncIterableIterator<T>>): AsyncIterableIterator<T> {
    let nextCollection = await iterIter.next();
    while (!nextCollection.done) {
        let nextItem = await nextCollection.value.next();
        while (!nextItem.done) {
            yield nextItem.value;
            nextItem = await nextCollection.value.next();
        }
        nextCollection = await iterIter.next();
    }
}

async function* mapAsyncIterator<T, U>(iter: AsyncIterator<T>, f: (x: T) => U): AsyncIterableIterator<U> {
    let next = await iter.next();
    while (!next.done) {
        const value = f(next.value);
        yield value;
        next = await iter.next();
    }
}

async function* filterAsyncIter<T>(iter: AsyncIterType<T>, f: (x: T) => boolean): AsyncIterType<T> {
    for await (const i of iter) {
        if (f(i)) {
            yield i;
        }
    }
}

async function* toAsyncIterator<T>(arr: T[]): AsyncIterableIterator<T> {
    yield* arr;
}

async function toAsyncArray<T>(asyncIter: AsyncIterator<T>): Promise<T[]> {
    const result: T[] = [];
    let next = await asyncIter.next();
    while (!next.done) {
        result.push(next.value);
        next = await asyncIter.next();
    }

    return result;
}
