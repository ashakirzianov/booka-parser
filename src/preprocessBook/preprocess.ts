import { Book } from 'booka-common';
import { optimizeBook } from './optimizeBook';
import { simplifyBook } from './simplifyBook';
import { storeBuffers, StoreBufferFn } from './storeBuffers';

export type PreprocessEnv = {
    storeBuffer?: StoreBufferFn,
};
export async function preprocessBook(book: Book, env: PreprocessEnv): Promise<Book> {
    const simplified = simplifyBook(book);
    const optimized = optimizeBook(simplified);
    const resolved = env.storeBuffer
        ? await storeBuffers(optimized, env.storeBuffer)
        : optimized;
    return resolved;
}
