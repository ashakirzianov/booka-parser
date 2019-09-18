import { createHash } from 'crypto';
import { Book, extractNodeText } from 'booka-common';
import { createReadStream } from 'fs';

export function bookHash(book: Book) {
    const input = extractNodeText(book.volume);
    return createHash('sha1')
        .update(input)
        .digest('base64');
}

export function bufferHash(buffer: Buffer) {
    return createHash('md5')
        .update(buffer)
        .digest('base64');
}

export function fileHash(filePath: string) {
    return new Promise<string>((resolve, reject) => {
        try {
            const hash = createHash('md5');
            const stream = createReadStream(filePath);

            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('base64')));
        } catch (e) {
            reject(e);
        }
    });
}
