import { Book } from 'booka-common';
import { epubFileParser } from './epubFileParser';
import { epubBookParser } from './epubBookParser';
import { converterHooks } from './hooks';
import { xmlStringParser } from '../xmlParser';
import { pipeAsync, translateAsync, AsyncFullParser } from '../combinators';

export { EpubKind } from './epubBook';

export type EpubParserInput = {
    filePath: string,
};

export const epubParser: AsyncFullParser<EpubParserInput, Book> = pipeAsync(
    translateAsync(
        async input => epubFileParser({
            filePath: input.filePath,
            stringParser: xmlStringParser,
        }),
        book => ({
            epub: book,
            options: converterHooks,
        }),
    ),
    epubBookParser,
);
