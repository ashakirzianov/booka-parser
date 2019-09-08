import { createEpubParser } from './epubParser';
import { createConverter } from './epubConverter';
import { converterHooks } from './hooks';
import { string2tree } from '../xml';

export { EpubConverterResult } from './epubConverter.types';
export { Image } from './epubParser.types';

export async function parsePath(path: string) {
    const parser = createEpubParser(string2tree);
    const converter = createConverter({
        options: converterHooks,
    });
    const epub = await parser.parseFile(path);
    const result = converter.convertEpub(epub);

    return result;
}
