import { Book } from 'booka-common';
import { optimizeBook } from './optimizeBook';
import { simplifyBook } from './simplifyBook';
import { storeBuffers, ProcessImagesArgs } from './storeBuffers';

export async function preprocessBook(book: Book, env: ProcessImagesArgs): Promise<Book> {
    const simplified = simplifyBook(book);
    const optimized = optimizeBook(simplified);
    const resolved = env.restoreBuffer
        ? await storeBuffers(optimized, env)
        : optimized;
    return resolved;
}
