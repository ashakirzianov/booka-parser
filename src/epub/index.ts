import { createEpubParser } from './epubParser';
import { createConverter } from './epubConverter';
import { converterHooks } from './hooks';
import { xmlStringParser } from '../xml';

export { EpubConverterResult } from './epubConverter.types';
export { Image } from './epubParser.types';

export async function parsePath(path: string) {
    const parser = createEpubParser(xmlStringParser);
    const converter = createConverter({
        options: converterHooks,
    });
    const epub = await parser.parseFile(path);
    const result = converter.convertEpub(epub);

    return result;
}
