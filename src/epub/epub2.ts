import { EPub } from 'epub2';
import { EpubParser, EpubBook, EpubSection, EpubSource, EpubSourceResolver, resolveEpubSource } from './epubParser';
import { XmlNodeDocument } from '../xml';
import { last } from '../utils';

export function createEpubParser(xmlParser: (text: string) => (XmlNodeDocument | undefined)): EpubParser {
    return {
        async parseFile(filePath): Promise<EpubBook> {
            const epub = await FixedEpub.createAsync(filePath) as FixedEpub;

            const source = identifySource(epub);
            return {
                source,
                metadata: {
                    title: epub.metadata.title,
                    author: epub.metadata.creator,
                },
                imageResolver: () => undefined,
                sections: async function* () {
                    for (const el of epub.flow) {
                        if (el.id && el.href) {
                            // TODO: find better solution
                            const href = last(el.href.split('/'));
                            const chapter = await epub.chapterForId(el.id);
                            const node = xmlParser(chapter);

                            // TODO: report parsing issues
                            if (node) {
                                const section: EpubSection = {
                                    id: el.id,
                                    fileName: href,
                                    content: node,
                                };
                                yield section;
                            }
                        }
                    }
                },
            };
        },
    };
}

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

function identifySource(epub: EPub): EpubSource {
    return resolveEpubSource(epub, sourceResolver);
}

const sourceResolver: EpubSourceResolver<EPub> = {
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

function getRawData(object: any): object | undefined {
    const symbol = EPub.SYMBOL_RAW_DATA;
    return object[symbol];
}
