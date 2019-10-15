import { Book } from 'booka-common';
import {
    Success, success, Diagnostic, compoundDiagnostic,
} from '../../combinators';
import { EpubBook } from '../epubFileParser';
import { collectMetrics, metricsDiff } from './bookMetrics';

export type PreprocessorArgs = { book: Book, epub: EpubBook };
export type BookPreprocessor = (args: PreprocessorArgs) => Promise<Success<Book>>;

export async function preprocessWithProcessors({ book, epub }: PreprocessorArgs, processors: BookPreprocessor[]): Promise<Success<Book>> {
    const diags: Diagnostic[] = [];
    const before = collectMetrics(book);
    for (const proc of processors) {
        const result = await proc({ book, epub });
        diags.push(result.diagnostic);
        book = result.value;
    }
    const after = collectMetrics(book);
    const diff = metricsDiff(before, after);
    if (diff !== undefined) {
        diags.push({
            diag: 'metrics changed',
            diff,
        });
    }

    return success(book, compoundDiagnostic(diags));
}
