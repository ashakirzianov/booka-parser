import { KnownTag, BookContentNode } from 'booka-common';

type DefElement<K extends string> = {
    element: K,
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

export type IgnoreElement = DefElement<'ignore'>;

export type BookElement =
    | ContentElement | TitleElement | TagElement | IgnoreElement
    ;
export type TitleOrContentElement = TitleElement | ContentElement;

export function isTitleOrContentElement(element: BookElement): element is TitleOrContentElement {
    return isContentElement(element) || isTitleElement(element);
}

export function isContentElement(element: BookElement): element is ContentElement {
    return element.element === 'content';
}

export function isTitleElement(element: BookElement): element is TitleElement {
    return element.element === 'chapter-title';
}
