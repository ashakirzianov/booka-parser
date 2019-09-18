import { epubParser } from './epub';
import { preprocessBook, StoreBufferFn } from './preprocessBook';
import { reject, ResultLast, translateAsync } from './combinators';
import { Book } from 'booka-common';

export { storeBuffers } from './preprocessBook';

export {
    Result, ResultLast,
    isCompoundDiagnostic, isEmptyDiagnostic, ParserDiagnostic,
} from './combinators';

export const parserVersion = '1.1.2';

export type ParseEpubInput = {
    filePath: string,
    storeImages?: StoreBufferFn,
};
export type ParseEpubOutput = {
    book: Book,
};

export async function parseEpub({ filePath, storeImages }: ParseEpubInput): Promise<ResultLast<ParseEpubOutput>> {
    const parser = translateAsync(
        epubParser,
        async book => {
            const preprocessed = await preprocessBook(book, {
                storeBuffer: storeImages,
            });

            const output: ParseEpubOutput = {
                book: preprocessed,
            };

            return output;
        }
    );

    try {
        const result = parser({ filePath });
        return result;
    } catch (e) {
        return reject({ diag: 'exception', err: e });
    }
}
