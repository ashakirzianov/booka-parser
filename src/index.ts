import { epubParser } from './epub';
import { preprocessBook, StoreBufferFn } from './preprocessBook';
import { AsyncParser, reject } from './combinators';
import { Book } from 'booka-common';
import { RestoreBufferFn } from './preprocessBook/storeBuffers';

export { storeBuffers } from './preprocessBook';

export const parserVersion = '1.1.2';

export type ParseEpubInput = {
    filePath: string,
    storeImages?: StoreBufferFn,
    restoreImages?: RestoreBufferFn,
};
export const parseEpub: AsyncParser<ParseEpubInput, Book> = async ({ filePath, storeImages, restoreImages }) => {
    try {
        const result = await epubParser({ filePath });
        if (result.success) {
            const preprocessed = await preprocessBook(result.value, {
                storeBuffer: storeImages,
                restoreBuffer: restoreImages,
            });

            return {
                ...result,
                value: preprocessed,
            };
        } else {
            return result;
        }
    } catch (e) {
        return reject({ diag: 'exception', err: e });
    }
};
