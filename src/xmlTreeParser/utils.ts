import { XmlTree, tree2String } from '../xmlStringParser';
import {
    Stream, alwaysYield, reject, yieldLast, headParser, translate,
    Parser, some, reportUnparsedTail,
} from '../combinators';
import { equalsToOneOf } from '../utils';
import { TreeParser, xmlChildren, path } from './treeParser';
import { Span, flatten, BookContentNode } from 'booka-common';
import { BookElement } from '../bookElementParser';

export type TreeParserEnv = {
    spanParser: Tree2SpanParser,
    nodeParser: Tree2ElementsParser,
    paragraphParser: Tree2NodeParser,
    filePath: string,
};
export type EpubTreeParser<T> = TreeParser<T, TreeParserEnv>;
export type Tree2ElementsParser = EpubTreeParser<BookElement[]>;
export type Tree2SpanParser = EpubTreeParser<Span>;
export type Tree2NodeParser = EpubTreeParser<BookContentNode>;

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

export function stream2string(input: Stream<XmlTree>): string {
    return input
        .stream
        .map(tree2String)
        .join('\n');
}
