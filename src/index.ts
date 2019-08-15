import { parsePath, Image } from './epub';
import { VolumeNode } from './bookFormat';
import { preprocessBook } from './preprocessBook';

export const parserVersion = '1.1.2';

export type ParsingResult = {
    volume: VolumeNode,
    resolveImage(imageId: string): Promise<Image | undefined>,
};
export async function parseEpubAtPath(path: string): Promise<ParsingResult> {
    const output = await parsePath(path);
    const preprocessed = preprocessBook(output.value.volume);

    return {
        volume: preprocessed,
        resolveImage: output.value.resolveImage,
    };
}
