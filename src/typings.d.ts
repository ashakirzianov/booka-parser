declare module '@rgrove/parse-xml' {
    type ParsingOptions = {
        preserveComments?: boolean,
    };
    const parseXml: (xml: string, options?: ParsingOptions) => any;
    export = parseXml;
}

// TODO: remove?
declare type GeneralObject = any;
declare type HtmlNodeObject = any;
