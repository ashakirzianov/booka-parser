import { parsePath, EpubConverterResult } from './epub';
import { preprocessBook } from './preprocessBook';

export const parserVersion = '1.1.2';

export type ParsingResult = EpubConverterResult;
export async function parseEpubAtPath(path: string): Promise<ParsingResult> {
    const converterResult = await parsePath(path);
    const preprocessed = preprocessBook(converterResult.volume);

    return {
        volume: preprocessed,
        resolveImage: converterResult.resolveImage,
        diagnostics: converterResult.diagnostics,
    };
}
