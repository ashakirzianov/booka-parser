import { Semantic } from 'booka-common';

export type IntermAttrs = {
    [k: string]: string | undefined,
};
type Interm<K extends string> = {
    interm: K,
    attrs: IntermAttrs,
    semantics?: Semantic[],
};

type NoContent = { content?: undefined };
export type IntermIgnore = Interm<'ignore'> & NoContent;
export type IntermImage = Interm<'image'> & NoContent;
export type IntermSeparator = Interm<'separator'> & NoContent;

export type IntermTextSpan = Interm<'text'> & {
    content: string,
};
export const interSpanNames = [
    'italic', 'bold', 'small', 'big', 'sub', 'sup', 'a',
    'span', 'quote', 'ins',
] as const;
export type IntermSpanName = typeof interSpanNames[number];
export type IntermNamedSpan = Interm<IntermSpanName> & {
    content: IntermSpan[],
};
export type IntermSpan = IntermTextSpan | IntermNamedSpan | IntermImage;

export type IntermPph = Interm<'pph'> & {
    content: IntermSpan[],
};

export type IntermHeader = Interm<'header'> & {
    level: number,
    content: IntermSpan[],
};

export type IntermListItem = Interm<'item'> & {
    content: IntermSpan[],
};
export type IntermList = Interm<'list'> & {
    kind: 'ordered' | 'unordered',
    content: IntermListItem[],
};

export type IntermTableCell = Interm<'cell'> & {
    content: IntermSpan[],
};
export type IntermTableRow = Interm<'row'> & {
    content: IntermTableCell[],
};
export type IntermTable = Interm<'table'> & {
    content: IntermTableRow[],
};

export type IntermContainer = Interm<'container'> & {
    content: IntermTop[],
};

export type IntermTop =
    | IntermPph | IntermHeader | IntermImage
    | IntermTable | IntermList
    | IntermSeparator | IntermIgnore
    | IntermContainer;
export type IntermSub =
    | IntermTableRow | IntermTableCell | IntermListItem | IntermSpan;
export type IntermNode = IntermTop | IntermSub;
export type IntermNodeKey = IntermNode['interm'];
export type IntermForKey<K extends IntermNodeKey> = Extract<IntermNode, { interm: K }>;
export type IntermContentForKey<K extends IntermNodeKey> =
    IntermForKey<K>['content'];
export type IntermContent = IntermNode['content'];

export function isIntermSpan(node: IntermNode): node is IntermSpan {
    return node.interm === 'text'
        || interSpanNames.some(an => an === node.interm);
}
