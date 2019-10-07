type Interm<K extends string> = {
    interm: K,
    attrs: Attributes,
};

export type Attributes = {
    [k: string]: string | undefined,
};

export type IntermTextSpan = {
    interm: 'text',
    attrs: Attributes,
    content: string,
};
export const interSpanNames = [
    'italic', 'bold', 'small', 'big', 'sub', 'sup', 'a',
    'img', 'span', 'quote', 'ins', 'text',
] as const;
export type IntermSpanName = typeof interSpanNames[number];
export type IntermNamedSpan = Interm<IntermSpanName> & {
    content: IntermSpan[],
};
export type IntermSpan = IntermTextSpan | IntermNamedSpan;

export type IntermPph = Interm<'pph'> & {
    content: IntermSpan[],
};

export type IntermHeader = Interm<'header'> & {
    level: number,
    content: IntermSpan,
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
    | IntermPph | IntermTable | IntermList | IntermHeader
    | IntermContainer;
export type IntermSub =
    | IntermTableRow | IntermTableCell | IntermListItem | IntermSpan;
export type IntermNode = IntermTop | IntermSub;
