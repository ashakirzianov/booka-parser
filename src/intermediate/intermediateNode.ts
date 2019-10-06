type Interm<K extends string, C extends IntermAllKey> = {
    interm: K,
    attrs: Attributes,
    content: Array<IntermForKey<C>>,
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
export type IntermNamedSpan = Interm<IntermSpanName, IntermSpanKey>;
export type IntermSpanKey = IntermSpanName | 'text';
export type IntermSpan = IntermTextSpan | IntermNamedSpan;

export type IntermPph = Interm<'pph', IntermSpanKey>;

export type IntermHeader = Interm<'header', IntermSpanKey> & {
    level: number,
};

export type IntermListItem = Interm<'item', IntermSpanKey>;
export type IntermList = Interm<'list', 'item'> & {
    kind: 'ordered' | 'unordered',
};

export type IntermTableCell = Interm<'cell', IntermSpanKey>;
export type IntermTableRow = Interm<'row', 'cell'>;
export type IntermTable = Interm<'table', 'row'>;
export type IntermContainer = Interm<'container', IntermTopSimple['interm'] | 'container'>;

type IntermTopSimple =
    | IntermPph | IntermTable | IntermList | IntermHeader;
export type IntermTop = IntermTopSimple | IntermContainer;
type IntermSub =
    | IntermTableRow | IntermTableCell | IntermListItem | IntermSpan;

type IntermAll = IntermTop | IntermSub;
type IntermAllKey = IntermAll['interm'];
type IntermForKey<K extends IntermAllKey> =
    Extract<IntermAll, { interm: K }>;
