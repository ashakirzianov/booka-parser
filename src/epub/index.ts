import { Book } from 'booka-common';
import { epubParser } from './epubFileParser';
import { epubBookParser } from './epubBookParser';
import { converterHooks } from './hooks';
import { xmlStringParser } from '../xmlParser';
import { AsyncParser, success } from '../combinators';

export { MetadataRecord } from './epubBookParser';
export { EpubKind } from './epubBook';

export type FullEpubParser = AsyncParser<{ path: string }, Book>;

// TODO: properly handle diagnostics
export const epubFullParser: FullEpubParser = async input => {
    try {
        const bookResult = await epubParser({
            filePath: input.path,
            stringParser: xmlStringParser,
        });
        if (!bookResult.success) {
            return bookResult;
        }

        const result = await epubBookParser({
            epub: bookResult.value,
            options: converterHooks,
        });

        return result.success
            ? success(result.value, input, result.diagnostic)
            : result;
    } catch (e) {
        return fail({ custom: 'exception', err: e });
    }
};
