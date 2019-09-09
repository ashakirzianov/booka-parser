import { epubFullParser } from './epub';
import { preprocessBook, StoreBufferFn } from './preprocessBook';
import { Result } from './combinators';
import { Book } from 'booka-common';

export { storeBuffers } from './preprocessBook';

export const parserVersion = '1.1.2';

export type ParsingResult = Result<any, Book>;
export type ParsingOptions = {
    storeImages?: StoreBufferFn,
};
export async function parseEpubAtPath(path: string, options?: ParsingOptions): Promise<ParsingResult> {
    const converterResult = await epubFullParser({ path });
    if (converterResult.success) {
        const preprocessed = await preprocessBook(converterResult.value, {
            storeBuffer: options && options.storeImages,
        });

        return {
            ...converterResult,
            value: preprocessed,
        };
    } else {
        return converterResult;
    }
}
