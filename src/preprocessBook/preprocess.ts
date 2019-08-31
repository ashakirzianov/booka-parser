import { VolumeNode, Book } from 'booka-common';
import { optimizeVolume } from './optimizeBook';
import { simplifyVolume } from './simplifyBook';

export function preprocessBook(book: Book): Book {
    const simplified = simplifyVolume(book.volume);
    const optimized = optimizeVolume(simplified);
    return {
        ...book,
        volume: optimized,
    };
}
