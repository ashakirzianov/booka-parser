import { createEpubParser } from './epub2';
import { createConverter } from './converter';
import { converterHooks } from './hooks';
import { string2tree } from '../xml';

export { EpubConverterResult } from './epubConverter';
export { Image } from './epubParser';

export async function parsePath(path: string) {
    const parser = createEpubParser(string2tree);
    const converter = createConverter({
        options: converterHooks,
    });
    const epub = await parser.parseFile(path);
    const result = converter.convertEpub(epub);

    return result;
}
