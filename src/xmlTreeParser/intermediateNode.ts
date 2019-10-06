type Inter<K extends string> = {
    inter: string,
    attrs: Attributes,
};

export type Attributes = {
    [k: string]: string | undefined,
};

export type InterTextSpan = Inter<'text'> & {
    text: string,
};
export const interSpanNames = [
    'i', 'b', 'small', 'big', 'sub', 'sup', 'a',
];
export type InterSpanName = typeof interSpanNames[number];
export type InterNamedSpan = Inter<'span'> & {
    name: InterSpanName,
    content: InterSpan[],
};
export type InterSpan = | InterNamedSpan;

export type InterPph = Inter<'pph'> & {
    spans: InterSpan[],
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
