export type TextBlock = {
    block: 'text',
    text: string,
};
export type AttrsBlock = {
    block: 'attrs',
    content: Block,
    attr: 'italic' | 'bold',
};
export type FootnoteRefBlock = {
    block: 'footnote-ref',
    id: string,
    content: Block,
};
export type FootnoteCandidateBlock = {
    block: 'footnote-candidate',
    id: string,
    title: string[],
    content: Block,
};
export type ChapterTitleBlock = {
    block: 'chapter-title',
    title: string[],
    level: number,
};
export type BookTitleBlock = {
    block: 'book-title',
    title: string,
};
export type BookAuthorBlock = {
    block: 'book-author',
    author: string,
};
export type ContainerBlock = {
    block: 'container',
    content: Block[],
};
export type IgnoreBlock = {
    block: 'ignore',
};
export type Block =
    | TextBlock
    | AttrsBlock
    | FootnoteRefBlock
    | FootnoteCandidateBlock
    | ChapterTitleBlock
    | BookTitleBlock
    | BookAuthorBlock
    | ContainerBlock
    | IgnoreBlock
    ;
