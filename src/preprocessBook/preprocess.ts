import { Book } from 'booka-common';
import { optimizeVolume } from './optimizeBook';
import { simplifyVolume } from './simplifyBook';
import { storeBuffers, StoreBufferFn } from './storeBuffers';

export type PreprocessEnv = {
    storeBuffer?: StoreBufferFn,
};
export async function preprocessBook(book: Book, env: PreprocessEnv): Promise<Book> {
    const simplified = simplifyVolume(book.volume);
    const optimized = optimizeVolume(simplified);
    const resolved = env.storeBuffer
        ? await storeBuffers(optimized, env.storeBuffer)
        : optimized;
    return {
        ...book,
        volume: resolved,
    };
}
