export type AttributeName = 'italic' | 'bold' | 'poem' | 'line';
export type SimpleSpan = string;
export type AttributedSpan = {
    span: 'attrs',
    content: Span,
    attrs?: AttributeName[],
};
export type CompoundSpan = {
    span: 'compound',
    spans: Span[],
};
export type FootnoteId = string;
export type FootnoteSpan = {
    span: 'note',
    content: Span,
    footnote: Span,
    id: FootnoteId,
    title: string[],
};
export type Span =
    | SimpleSpan | CompoundSpan
    | FootnoteSpan | AttributedSpan
    ;

export type ParagraphNode = {
    node: 'paragraph',
    span: Span,
};

export type ChapterTitle = string[];
export type ChapterNode = {
    node: 'chapter',
    level: number,
    title: ChapterTitle,
    nodes: ContentNode[],
};

export type ContentNode = ChapterNode | ParagraphNode;

export type BookMeta = {
    title: string,
    author?: string,
};

export type VolumeNode = {
    node: 'volume',
    meta: BookMeta,
    nodes: ContentNode[],
};

export type BookNode = VolumeNode | ContentNode;
export type HasSubnodes = VolumeNode | ChapterNode;
export type BookObject = VolumeNode;
