import {
    normalizeBook, success,
} from 'booka-common';
import { PreprocessorArgs } from './preprocessor';

export async function normalize({ book, epub }: PreprocessorArgs) {
    const normalized = normalizeBook(book);

    return success(normalized);
}
