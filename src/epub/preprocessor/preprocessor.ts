import { Book } from 'booka-common';
import {
    SuccessLast, yieldLast, Diagnostic, compoundDiagnostic,
} from '../../combinators';
import { EpubBook } from '../epubFileParser';
import { collectMetrics, metricsDiff } from './bookMetrics';

export type PreprocessorArgs = { book: Book, epub: EpubBook };
export type BookPreprocessor = (args: PreprocessorArgs) => Promise<SuccessLast<Book>>;

export async function preprocessWithProcessors({ book, epub }: PreprocessorArgs, processors: BookPreprocessor[]): Promise<SuccessLast<Book>> {
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

    return yieldLast(book, compoundDiagnostic(diags));
}
