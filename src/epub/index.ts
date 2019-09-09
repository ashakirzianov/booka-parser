import { epubParser } from './epubFileParser';
import { epubBookParser } from './epubBookParser';
import { converterHooks } from './hooks';
import { xmlStringParser } from '../xmlParser';

export { MetadataRecord, EpubBookParserResult as EpubConverterResult } from './epubBookParser';
export { EpubKind } from './epubBook';

// TODO: properly handle diagnostics
export async function parsePath(path: string) {
    const bookResult = await epubParser({
        filePath: path,
        stringParser: xmlStringParser,
    });
    if (!bookResult.success) {
        return bookResult;
    }

    const result = epubBookParser({
        epub: bookResult.value,
        options: converterHooks,
    });

    return result;
}
