import { KnownTag, BookContentNode, Span, SupportSemantic } from 'booka-common';

// TODO: rename

type DefElement<K extends string> = {
    node: K,
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
export type SpanElement = DefElement<'span'> & {
    span: Span,
};
export type ImageRefElement = DefElement<'image-ref'> & {
    imageId: string,
};
export type IgnoreElement = DefElement<'ignore'>;

// TODO: remove
export type CompoundElement = SupportSemantic<DefElement<'compound-raw'> & {
    nodes: BookElement[],
}, 'footnote'>;
export type ImageUrlElement = DefElement<'image-url'> & {
    id: string,
    url: string,
};
export type ImageDataElement = DefElement<'image-data'> & {
    id: string,
    data: Buffer,
};
export type ImageElement = ImageUrlElement | ImageDataElement;

export type BookElement =
    | ContentElement | TitleElement | TagElement
    | ImageRefElement | SpanElement | IgnoreElement
    | CompoundElement | ImageElement
    ;
