import { parsePath, EpubConverterResult } from './epub';
import { preprocessBook, StoreBufferFn } from './preprocessBook';
import { Result } from './combinators';

export { storeBuffers } from './preprocessBook';

export const parserVersion = '1.1.2';

export type ParsingResult = Result<any, EpubConverterResult>;
export type ParsingOptions = {
    storeImages?: StoreBufferFn,
};
export async function parseEpubAtPath(path: string, options?: ParsingOptions): Promise<ParsingResult> {
    const converterResult = await parsePath(path);
    if (converterResult.success) {
        const preprocessed = await preprocessBook(converterResult.value.book, {
            storeBuffer: options && options.storeImages,
        });

        return {
            ...converterResult,
            value: {
                ...converterResult.value,
                book: preprocessed,
            },
        };
    } else {
        return converterResult;
    }
}
