declare module '@rgrove/parse-xml' {
    type ParsingOptions = {
        preserveComments?: boolean,
        ignoreUndefinedEntities?: boolean,
    };
    const parseXml: (xml: string, options?: ParsingOptions) => any;
    export = parseXml;
}
