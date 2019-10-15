import {
    normalizeBook,
} from 'booka-common';
import {
    yieldLast,
} from '../../combinators';
import { PreprocessorArgs } from './preprocessor';

export async function normalize({ book, epub }: PreprocessorArgs) {
    const normalized = normalizeBook(book);

    return yieldLast(normalized);
}
