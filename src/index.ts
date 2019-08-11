import { path2book } from './epub';
import { VolumeNode } from './common/bookFormat';
import { logger } from './log';
import { preprocessBook } from './preprocessBook';

export async function loadEpubPath(path: string): Promise<VolumeNode> {
    const book = await path2book(path);
    book.diagnostics.log(logger());
    const preprocessed = preprocessBook(book.value);

    return preprocessed;
}
