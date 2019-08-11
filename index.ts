import { path2book } from './src/epub';
import { VolumeNode } from './src/bookFormat';
import { preprocessBook } from './src/preprocessBook';

export async function loadEpubPath(path: string): Promise<VolumeNode> {
    const book = await path2book(path);
    const preprocessed = preprocessBook(book.value);

    return preprocessed;
}
