import { createEpubParser } from './epubParser';
import { createConverter } from './epubConverter';
import { converterHooks } from './hooks';
import { xmlStringParser } from '../xmlParser';

export { EpubConverterResult, MetadataRecord } from './epubConverter.types';
export { EpubKind } from './epubBook';

export async function parsePath(path: string) {
    const parser = createEpubParser(xmlStringParser);
    const converter = createConverter({
        options: converterHooks,
    });
    const epub = await parser.parseFile(path);
    const result = converter.convertEpub(epub);

    return result;
}
