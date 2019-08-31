import { EPub } from 'epub2';
import { EpubParser, EpubBook, EpubSection, EpubKind, EpubKindResolver, resolveEpubKind } from './epubParser.types';
import { XmlNodeDocument } from '../xml';
import { last } from '../utils';

export function createEpubParser(xmlParser: (text: string) => (XmlNodeDocument | undefined)): EpubParser {
    return {
        async parseFile(filePath): Promise<EpubBook> {
            const epub = await FixedEpub.createAsync(filePath) as FixedEpub;

            const kind = identifyKind(epub);
            return {
                kind: kind,
                metadata: {
                    title: epub.metadata.title,
                    author: epub.metadata.creator,
                    cover: getCoverRef(epub),
                },
                imageResolver: async href => {
                    // const root = 'OPS/';
                    // const path = root + href;
                    // return new Promise((res, rej) => {
                    //     epub.readFile(path, undefined, (err: any, data: any) => {
                    //         if (err) {
                    //             rej(err);
                    //         } else {
                    //             res({
                    //                 buffer: data,
                    //             });
                    //         }
                    //     });
                    // });

                    const idItem = epub.listImage().find(item => item.href && item.href.endsWith(href));
                    if (!idItem || !idItem.id) {
                        return undefined;
                    }
                    const [buffer, mimeType] = await epub.getImageAsync(idItem.id);
                    return buffer;
                },
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
                                    filePath: href,
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

function getCoverRef(epub: EPub): string | undefined {
    const coverId = epub.metadata.cover;
    if (coverId) {
        const coverItem = epub.listImage().find(item => item.id === coverId);
        if (coverItem) {
            return coverItem.href;
        }
    }

    return undefined;
}

function identifyKind(epub: EPub): EpubKind {
    return resolveEpubKind(epub, kindResolver);
}

const kindResolver: EpubKindResolver<EPub> = {
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
