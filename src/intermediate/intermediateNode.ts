type Interm<K extends string> = {
    interm: K,
    attrs: Attributes,
};

export type Attributes = {
    [k: string]: string | undefined,
};

export type IntermTextSpan = Interm<'text'> & {
    content: string,
};
export const interSpanNames = [
    'italic', 'bold', 'small', 'big', 'sub', 'sup', 'a',
    'img', 'span', 'quote', 'ins',
] as const;
export type IntermSpanName = typeof interSpanNames[number];
export type IntermNamedSpan = Interm<'span'> & {
    name: IntermSpanName,
    content: IntermSpan[],
};
export type IntermSpan = IntermTextSpan | IntermNamedSpan;

export type IntermPph = Interm<'pph'> & {
    content: IntermSpan[],
};

export type IntermHeader = Interm<'header'> & {
    level: number,
    content: IntermSpan[],
};

export type IntermContainer = Interm<'container'> & {
    content: IntermediateNode[],
};

export type IntermediateNode =
    | IntermPph
    | IntermHeader
    | IntermContainer
    ;
export type IntermediateNodeKey = IntermediateNode['interm'];
export type IntermediateNodeForKey<K extends IntermediateNodeKey> =
    Extract<IntermediateNode, { inter: K }>;
export type IntermediateNodeContent<K extends IntermediateNodeKey> = IntermediateNodeForKey<K>['content'];
