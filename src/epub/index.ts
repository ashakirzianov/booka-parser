import { Book } from 'booka-common';
import { epubFileParser } from './epubFileParser';
import { epubBookParser } from './epubBookParser';
import { converterHooks } from './hooks';
import { xmlStringParser } from '../xmlParser';
import { AsyncParser, yieldOne } from '../combinators';

export { EpubKind } from './epubBook';

export type EpubParserInput = {
    filePath: string,
};

// TODO: properly handle diagnostics
export const epubParser: AsyncParser<EpubParserInput, Book> = async ({ filePath }) => {
    const bookResult = await epubFileParser({
        filePath: filePath,
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
        ? yieldOne(result.value, { filePath }, result.diagnostic)
        : result;
};
