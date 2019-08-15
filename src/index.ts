import { parsePath, Image } from './epub';
import { VolumeNode } from './bookFormat';
import { preprocessBook } from './preprocessBook';

export const parserVersion = '1.1.2';

export type ParsingResult = {
    volume: VolumeNode,
    resolveImage(imageId: string): Promise<Image | undefined>,
};
export async function parseEpubAtPath(path: string): Promise<ParsingResult> {
    const book = await parsePath(path);
    const preprocessed = preprocessBook(book.value.volume);

    return {
        volume: preprocessed,
        resolveImage: async () => undefined, // TODO: implement
    };
}
