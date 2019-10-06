type Inter<K extends string> = {
    inter: K,
    attrs: Attributes,
};

export type Attributes = {
    [k: string]: string | undefined,
};

export type InterTextSpan = Inter<'text'> & {
    content: string,
};
export const interSpanNames = [
    'italic', 'bold', 'small', 'big', 'sub', 'sup', 'a',
] as const;
export type InterSpanName = typeof interSpanNames[number];
export type InterNamedSpan = Inter<'span'> & {
    name: InterSpanName,
    content: InterSpan[],
};
export type InterSpan = InterTextSpan | InterNamedSpan;

export type InterPph = Inter<'pph'> & {
    content: InterSpan[],
};

export type InterHeader = Inter<'header'> & {
    level: number,
    content: InterSpan[],
};

export type InterContainer = Inter<'container'> & {
    content: IntermediateNode[],
};

export type IntermediateNode =
    | InterPph
    | InterHeader
    | InterContainer
    ;
export type IntermediateNodeKey = IntermediateNode['inter'];
export type IntermediateNodeForKey<K extends IntermediateNodeKey> =
    Extract<IntermediateNode, { inter: K }>;
export type IntermediateNodeContent<K extends IntermediateNodeKey> = IntermediateNodeForKey<K>['content'];
