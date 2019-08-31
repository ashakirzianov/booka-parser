import { parsePath, EpubConverterResult } from './epub';
import { preprocessBook } from './preprocessBook';
import { Book } from 'booka-common';

export { Image } from './epub';

export const parserVersion = '1.1.2';

export type ParsingResult = EpubConverterResult;
export async function parseEpubAtPath(path: string): Promise<ParsingResult> {
    const converterResult = await parsePath(path);
    if (converterResult.success) {
        const book: Book = {
            volume: converterResult.volume,
        };
        const preprocessed = preprocessBook(book);

        return {
            success: true,
            volume: preprocessed.volume,
            resolveImage: converterResult.resolveImage,
            diagnostics: converterResult.diagnostics,
        };
    } else {
        return converterResult;
    }
}
