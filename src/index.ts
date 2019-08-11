import { path2book } from './epub';
import { VolumeNode } from './bookFormat';
import { preprocessBook } from './preprocessBook';

export async function loadEpubPath(path: string): Promise<VolumeNode> {
    const book = await path2book(path);
    const preprocessed = preprocessBook(book.value);

    return preprocessed;
}
