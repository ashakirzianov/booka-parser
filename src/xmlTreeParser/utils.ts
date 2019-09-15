import { XmlTree } from '../xmlStringParser';
import { Stream, alwaysYield, reject, yieldLast, headParser, choice, fullParser, translate, Parser } from '../combinators';
import { equalsToOneOf } from '../utils';
import { TreeParser, xmlChildren, path } from './treeParser';
import { Span, flatten } from 'booka-common';
import { BookElement } from '../bookElementParser';
import { nodeParser } from './nodeParser';

export type TreeParserEnv = {
    span: Tree2SpanParser,
    recursive: Tree2ElementsParser,
    filePath: string,
};
export type EpubTreeParser<T> = TreeParser<T, TreeParserEnv>;
export type Tree2ElementsParser = EpubTreeParser<BookElement[]>;
export type Tree2SpanParser = EpubTreeParser<Span>;

export function buildDocumentParser(hooks: Tree2ElementsParser[]): Tree2ElementsParser {
    const nodeParser2 = choice(...hooks, nodeParser);
    const insideParser = flattenResult(fullParser(nodeParser2));
    const bodyParser = xmlChildren(insideParser);
    const documentParser = path(['html', 'body'], bodyParser);

    return documentParser;
}

export function ignoreClass(className: string): Tree2ElementsParser {
    return headParser(el =>
        el.type === 'element' && el.attributes.class === className
            ? yieldLast([])
            : reject()
    );
}

export function ignoreTags(tags: string[]): Tree2ElementsParser {
    return headParser(el =>
        equalsToOneOf(el.name, tags)
            ? yieldLast([])
            : reject()
    );
}

export function buildRef(filePath: string, id: string | undefined) {
    return id !== undefined
        ? `${filePath}#${id}`
        : undefined;
}

export function logWhileParsing(message?: string, dontLogTree?: boolean) {
    return alwaysYield((stream: Stream<XmlTree, TreeParserEnv>) => {
        if (!dontLogTree) {
            // tslint:disable-next-line: no-console
            console.log(stream.stream[0]);
        }
        if (message) {
            // tslint:disable-next-line: no-console
            console.log(message);
        }
        return;
    });
}

export function flattenResult<I, O>(parser: Parser<I, O[][]>): Parser<I, O[]> {
    return translate(parser, flatten);
}
