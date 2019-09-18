import { createHash } from 'crypto';
import { Book, extractNodeText } from 'booka-common';

export function bookHash(book: Book) {
    const input = extractNodeText(book.volume);
    return createHash('sha1')
        .update(input)
        .digest('base64');
}

export function bufferHash(buffer: Buffer) {
    return createHash('sha1')
        .update(buffer)
        .digest('base64');
}
