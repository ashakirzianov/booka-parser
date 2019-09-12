import { KnownTag, BookContentNode, Span, SupportSemantic } from 'booka-common';

// TODO: rename

type DefRaw<K extends string> = {
    node: K,
    refId?: string,
};
export type ContentRaw = DefRaw<'content'> & {
    content: BookContentNode,
};
export type ImageRefNode = DefRaw<'image-ref'> & {
    imageId: string,
};
export type TitleNode = DefRaw<'chapter-title'> & {
    title: string[],
    level: number,
};
export type TagNode = DefRaw<'tag'> & {
    tag: KnownTag,
};

// TODO: do we need it ?
export type SpanNode = DefRaw<'span'> & {
    span: Span,
};

// TODO: remove
export type RawCompoundNode = SupportSemantic<DefRaw<'compound-raw'> & {
    nodes: RawBookNode[],
}, 'footnote'>;
export type ImageUrlNode = DefRaw<'image-url'> & {
    id: string,
    url: string,
};
export type ImageDataNode = DefRaw<'image-data'> & {
    id: string,
    data: Buffer,
};
export type ImageNode = ImageUrlNode | ImageDataNode;

export type IgnoreNode = DefRaw<'ignore'>;
export type RawBookNode =
    | ImageRefNode | TitleNode | TagNode | SpanNode | IgnoreNode
    | ContentRaw
    | RawCompoundNode | ImageNode
    ;
