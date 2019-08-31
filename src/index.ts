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
        const book: Book = {
            volume: converterResult.volume,
            source: {
                source: 'epub',
                kind: converterResult.kind,
            },
        };
        const preprocessed = await preprocessBook(book, {
            storeBuffer: options && options.storeImages,
        });

        return {
            ...converterResult,
            volume: preprocessed.volume,
        };
    } else {
        return converterResult;
    }
}
