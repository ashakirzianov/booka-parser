import { path2book } from './epub';
import { VolumeNode } from './bookFormat';
import { preprocessBook } from './preprocessBook';
import * as pkg from '../package.json';

export const parserVersion = pkg.version;
export async function loadEpubPath(path: string): Promise<VolumeNode> {
    const book = await path2book(path);
    const preprocessed = preprocessBook(book.value);

    return preprocessed;
}
