import { Book } from 'booka-common';
import { epubFileParser } from './epubFileParser';
import { epubBookParser } from './epubBookParser';
import { pipeAsync, AsyncFullParser } from '../combinators';
import { xmlStringParser, extractAllText } from '../xml';

// TODO: do not export
export { EpubBook } from './epubFileParser';

export type EpubParserInput = {
    filePath: string,
};

export const epubParser: AsyncFullParser<EpubParserInput, Book> = pipeAsync(
    epubFileParser,
    epubBookParser,
);

export async function parseEpubText(filePath: string): Promise<string> {
    const epub = await epubFileParser({
        filePath,
    });
    if (!epub.success) {
        return '';
    }

    let result = '';
    for await (const s of epub.value.sections()) {
        const xml = xmlStringParser({
            xmlString: s.content,
            removeTrailingWhitespaces: true,
        });
        if (xml.success) {
            result += extractAllText(xml.value);
        }
    }

    return result;
}
