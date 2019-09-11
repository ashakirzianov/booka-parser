import { XmlTreeDocument } from '../xmlParser';

export type EpubCollection<T> = AsyncIterableIterator<T>;

export type EpubSection = {
    filePath: string,
    id: string,
    content: XmlTreeDocument,
};

export type EpubMetadata = {
    [key: string]: string | string[] | undefined;
};

export type EpubKind =
    | 'fb2epub' | 'fictionBookEditor' | 'gutenberg'
    | 'unknown'
    ;
export type EpubKindResolver<EpubType> = {
    [key in Exclude<EpubKind, 'unknown'>]: (epub: EpubType) => boolean;
};
export function resolveEpubKind<EpubType>(epub: EpubType, resolver: EpubKindResolver<EpubType>): EpubKind {
    for (const [kind, predicate] of Object.entries(resolver)) {
        if (predicate(epub)) {
            return kind as EpubKind;
        }
    }

    return 'unknown';
}

export type EpubBook = {
    kind: EpubKind,
    metadata: EpubMetadata,
    imageResolver(id: string): Promise<Buffer | undefined>,
    sections(): EpubCollection<EpubSection>,
};
