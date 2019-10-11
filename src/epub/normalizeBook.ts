import { Book, extractBookText, normalizeBook } from 'booka-common';
import { SuccessLast, ParserDiagnostic, yieldLast } from '../combinators';

export function normalize(book: Book): SuccessLast<Book> {
    const before = extractBookText(book);
    const normalized = normalizeBook(book);
    const after = extractBookText(normalized);
    const diag: ParserDiagnostic = before === after
        ? undefined
        : {
            diag: 'normalized text changed',
        };

    return yieldLast(normalized, diag);
}
