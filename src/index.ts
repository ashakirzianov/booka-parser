import { parsePath, EpubConverterResult } from './epub';
import { preprocessBook } from './preprocessBook';

export { Image } from './epub';

export const parserVersion = '1.1.2';

export type ParsingResult = EpubConverterResult;
export async function parseEpubAtPath(path: string): Promise<ParsingResult> {
    const converterResult = await parsePath(path);
    if (converterResult.success) {
        const preprocessed = preprocessBook(converterResult.volume);

        return {
            success: true,
            volume: preprocessed,
            resolveImage: converterResult.resolveImage,
            diagnostics: converterResult.diagnostics,
        };
    } else {
        return converterResult;
    }
}
