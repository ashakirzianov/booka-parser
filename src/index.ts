import { epubParser } from './epub';
import { preprocessBook, StoreBufferFn } from './preprocessBook';
import { reject, ResultLast, translateAsync } from './combinators';
import { Book } from 'booka-common';
import { bookHash, fileHash } from './utils';

export { storeBuffers } from './preprocessBook';

export {
    Result, ResultLast,
    isCompoundDiagnostic, isEmptyDiagnostic, ParserDiagnostic,
} from './combinators';

export const parserVersion = '1.1.2';

export type ParseEpubInput = {
    filePath: string,
    storeImages?: StoreBufferFn,
    buildHashes?: boolean,
};
export type ParseEpubOutput = {
    book: Book,
    fileHash?: string,
    bookHash?: string,
};

export async function parseEpub(input: ParseEpubInput & { buildHashes?: false }): Promise<ResultLast<{
    book: Book,
    fileHash?: undefined,
    bookHash?: undefined,
}>>;
export async function parseEpub(input: ParseEpubInput & { buildHashes: true }): Promise<ResultLast<{
    book: Book,
    fileHash: string,
    bookHash: string,
}>>;
export async function parseEpub({ filePath, storeImages, buildHashes }: ParseEpubInput): Promise<ResultLast<ParseEpubOutput>> {
    try {
        const parser = translateAsync(
            epubParser,
            async book => {
                const preprocessed = await preprocessBook(book, {
                    storeBuffer: storeImages,
                });

                const output: ParseEpubOutput = {
                    book: preprocessed,
                };
                if (buildHashes) {
                    output.bookHash = bookHash(preprocessed);
                    output.fileHash = await fileHash(filePath);
                }

                return output;
            }
        );
        const result = parser({ filePath });
        return result;
    } catch (e) {
        return reject({ diag: 'exception', err: e });
    }
}
