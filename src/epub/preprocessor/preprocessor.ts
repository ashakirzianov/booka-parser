import {
    Book, BookNode,
    processBookImages, justNodeGenerator, normalizeBook,
    mapSpan, Span, extractBookText, flatten,
} from 'booka-common';
import {
    SuccessLast, yieldLast, ParserDiagnostic, compoundDiagnostic,
} from '../../combinators';
import { xmlStringParser, extractAllText } from '../../xml';
import { EpubBook } from '../epubFileParser';
import { collectMetrics, metricsDiff } from './bookMetrics';

export type PreprocessorArgs = { book: Book, epub: EpubBook };
export type BookPreprocessor = (args: PreprocessorArgs) => Promise<SuccessLast<Book>>;

export async function preprocessWithProcessors({ book, epub }: PreprocessorArgs, processors: BookPreprocessor[]): Promise<SuccessLast<Book>> {
    const diags: ParserDiagnostic[] = [];
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

// Refs:

// Consistency:

// Normalization:
