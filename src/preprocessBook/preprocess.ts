import { Book } from 'booka-common';
import { storeBuffers, ProcessImagesArgs } from './storeBuffers';

export async function preprocessBook(book: Book, env: ProcessImagesArgs): Promise<Book> {
    const resolved = env.restoreBuffer
        ? await storeBuffers(book, env)
        : book;
    return resolved;
}
