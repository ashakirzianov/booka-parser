import { KnownTag, BookContentNode, SupportSemantic } from 'booka-common';

type DefElement<K extends string> = {
    element: K,
    // TODO: remove ?
    refId?: string,
};
export type ContentElement = DefElement<'content'> & {
    content: BookContentNode,
};
export type TitleElement = DefElement<'chapter-title'> & {
    title: string[],
    level: number,
};
export type TagElement = DefElement<'tag'> & {
    tag: KnownTag,
};

// TODO: do we need it ?
export type ImageRefElement = DefElement<'image-ref'> & {
    imageId: string,
};
export type IgnoreElement = DefElement<'ignore'>;

// TODO: remove
export type CompoundElement = SupportSemantic<DefElement<'compound'> & {
    elements: BookElement[],
}, 'footnote'>;
export type ImageUrlElement = DefElement<'image-url'> & {
    id: string,
    url: string,
};
export type ImageDataElement = DefElement<'image-data'> & {
    id: string,
    data: Buffer,
};

export type BookElement =
    | ContentElement | TitleElement | TagElement | CompoundElement
    | ImageRefElement | IgnoreElement
    ;
