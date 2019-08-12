import { XmlNode } from '../xml';

type Image = any; // TODO: actual image type
export type EpubCollection<T> = AsyncIterableIterator<T>;

export type EpubSection = {
    fileName: string,
    id: string,
    content: XmlNode,
};

export type EpubMetadata = {
    title?: string,
    author?: string,
};

export type EpubSource = 'fb2epub' | 'fictionBookEditor' | 'unknown';
export type EpubSourceResolver<EpubType> = {
    [key in Exclude<EpubSource, 'unknown'>]: (epub: EpubType) => boolean;
};
export function resolveEpubSource<EpubType>(epub: EpubType, resolver: EpubSourceResolver<EpubType>): EpubSource {
    for (const [source, predicate] of Object.entries(resolver)) {
        if (predicate(epub)) {
            return source as EpubSource;
        }
    }

    return 'unknown';
}

export type EpubBook = {
    source: EpubSource,
    metadata: EpubMetadata,
    imageResolver(id: string): Image | undefined,
    sections(): EpubCollection<EpubSection>,
};

export type EpubParser = {
    parseFile: (filePath: string) => Promise<EpubBook>,
};
