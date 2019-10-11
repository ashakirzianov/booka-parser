import { Book, extractBookText } from 'booka-common';

export type BookMetrics = {
    text: string,
};
export function collectMetrics(book: Book): BookMetrics {
    const text = extractBookText(book);
    return { text };
}

export function metricsDiff(before: BookMetrics, after: BookMetrics) {
    const textDiff = stringDiff(before.text, after.text);
    return textDiff === undefined
        ? undefined
        : textDiff;
}

function stringDiff(left: string, right: string) {
    for (let idx = 0; idx < left.length; idx++) {
        if (left[idx] !== right[idx]) {
            return {
                left: left.substr(idx, 100),
                right: right.substr(idx, 100),
            };
        }
    }

    return undefined;
}
