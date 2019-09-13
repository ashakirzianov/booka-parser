import { EPub } from 'epub2';
import {
    EpubBook, EpubSection, EpubKind, EpubKindResolver, resolveEpubKind, EpubMetadata,
} from './epubBook';
import { XmlStringParser } from '../xmlStringParser';
import { last } from '../utils';
import { AsyncParser, yieldLast } from '../combinators';

export type EpubFileParserInput = {
    filePath: string,
    stringParser: XmlStringParser,
};
export type EpubParser = AsyncParser<EpubFileParserInput, EpubBook>;

export const epubFileParser: EpubParser = async input => {
    const epub = await FixedEpub.createAsync(input.filePath) as FixedEpub;

    const kind = identifyKind(epub);
    const book: EpubBook = {
        kind: kind,
        metadata: extractMetadata(epub),
        imageResolver: async href => {

            const idItem = epub.listImage().find(item => item.href && item.href.endsWith(href));
            if (!idItem || !idItem.id) {
                return undefined;
            }
            const [buffer] = await epub.getImageAsync(idItem.id);
            return buffer;
        },
        sections: async function* () {
            for (const el of epub.flow) {
                if (el.id && el.href) {
                    // TODO: find better solution
                    const href = last(el.href.split('/'));
                    const chapter = await epub.chapterForId(el.id);
                    const xmlResult = input.stringParser(chapter);

                    // TODO: report parsing issues
                    if (xmlResult.success) {
                        const section: EpubSection = {
                            id: el.id,
                            filePath: href,
                            content: xmlResult.value,
                        };
                        yield section;
                    }
                }
            }
        },
    };

    return yieldLast(book);
};

class FixedEpub extends EPub {
    static libPromise = Promise;

    // This is workaround for epub2 bug. Remove it once fixed
    walkNavMap(branch: any, path: any, idList: any, level: number, pe?: any, parentNcx?: any, ncxIdx?: any) {
        if (Array.isArray(branch)) {
            branch.forEach(b => {
                if (b.navLabel && b.navLabel.text === '') {
                    b.navLabel.text = ' ';
                }
            });
        }
        return super.walkNavMap(branch, path, idList, level, pe, parentNcx, ncxIdx);
    }

    chapterForId(id: string): Promise<string> {
        return this.getChapterRawAsync(id);
    }
}

function extractMetadata(epub: EPub): EpubMetadata {
    const metadata = { ...epub.metadata } as any;
    const coverId = metadata.cover;
    if (coverId) {
        const coverItem = epub.listImage().find(item => item.id === coverId);
        if (coverItem) {
            metadata.cover = coverItem.href;
        }
    }
    const raw = getRawData(epub.metadata);
    metadata['dc:rights'] = raw['dc:rights'];
    metadata['dc:identifier'] = raw['dc:identifier'];

    return metadata;
}

function identifyKind(epub: EPub): EpubKind {
    return resolveEpubKind(epub, kindResolver);
}

const kindResolver: EpubKindResolver<EPub> = {
    gutenberg: epub => {
        const rawMetadata = getRawData(epub.metadata) as any;
        if (!rawMetadata) {
            return false;
        }

        const source = rawMetadata['dc:source'];
        return typeof source === 'string'
            && source.startsWith('http://www.gutenberg.org');
    },
    fb2epub: epub => {
        const rawMetadata = getRawData(epub.metadata) as any;
        if (!rawMetadata) {
            return false;
        }

        const contributor = rawMetadata['dc:contributor'];
        if (!contributor || !Array.isArray(contributor)) {
            return false;
        }

        const fb2epub = contributor
            .map(i => i['#'])
            .find(i => typeof i === 'string' && i.startsWith('Fb2epub'));

        return fb2epub !== undefined;
    },
    fictionBookEditor: epub => {
        const marker = epub.metadata['FB2.document-info.program-used'];
        return marker !== undefined && marker.startsWith('FictionBook Editor');
    },
};

function getRawData(object: any): any {
    const symbol = EPub.SYMBOL_RAW_DATA;
    return object[symbol];
}
