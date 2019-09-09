import { epubParser } from './epubParser';
import { createConverter } from './epubConverter';
import { converterHooks } from './hooks';
import { xmlStringParser } from '../xmlParser';
import { EpubConverterResult } from './epubConverter.types';

export { EpubConverterResult, MetadataRecord } from './epubConverter.types';
export { EpubKind } from './epubBook';

export async function parsePath(path: string): Promise<EpubConverterResult> {
    const bookResult = await epubParser({
        filePath: path,
        stringParser: xmlStringParser,
    });
    if (!bookResult.success) {
        return {
            success: false,
            diagnostics: [], // TODO: add proper diagnostics
        };
    }
    const converter = createConverter({
        options: converterHooks,
    });
    const result = converter.convertEpub(bookResult.value);

    return result;
}
