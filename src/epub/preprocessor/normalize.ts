import {
    normalizeBook,
} from 'booka-common';
import {
    success,
} from '../../combinators';
import { PreprocessorArgs } from './preprocessor';

export async function normalize({ book, epub }: PreprocessorArgs) {
    const normalized = normalizeBook(book);

    return success(normalized);
}
