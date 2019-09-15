import { Book } from 'booka-common';
import { epubFileParser } from './epubFileParser';
import { epubBookParser } from './epubBookParser';
import { pipeAsync, AsyncFullParser } from '../combinators';

export { EpubKind } from './epubBook';

export type EpubParserInput = {
    filePath: string,
};

export const epubParser: AsyncFullParser<EpubParserInput, Book> = pipeAsync(
    epubFileParser,
    epubBookParser,
);
