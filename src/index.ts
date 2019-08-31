import { Book } from 'booka-common';
import { parsePath, EpubConverterResult } from './epub';
import { preprocessBook, StoreBufferFn } from './preprocessBook';

export const parserVersion = '1.1.2';

export type ParsingResult = EpubConverterResult;
export type ParsingOptions = {
    storeImages?: StoreBufferFn,
};
export async function parseEpubAtPath(path: string, options?: ParsingOptions): Promise<ParsingResult> {
    const converterResult = await parsePath(path);
    if (converterResult.success) {
        const preprocessed = await preprocessBook(converterResult.book, {
            storeBuffer: options && options.storeImages,
        });

        return {
            ...converterResult,
            book: preprocessed,
        };
    } else {
        return converterResult;
    }
}
