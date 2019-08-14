import { string2tree } from '../xml';
import { createEpubParser } from './epub2';
import { createConverter } from './converter';
import { converterHooks } from './hooks';

export async function parseEpub(path: string) {
    const parser = createEpubParser(string2tree);
    const converter = createConverter({
        options: converterHooks,
    });
    const epub = await parser.parseFile(path);
    const result = converter.convertEpub(epub);

    return result;
}
