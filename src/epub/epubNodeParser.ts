import { RawBookNode } from 'booka-common';
import { ParserDiagnoser } from '../log';
import {
    XmlTree, TreeParser, elementNode,
} from '../xmlParser';
import {
    SuccessParser, Stream, some, yieldOne, success, successValue, fail,
} from '../combinators';
import { equalsToOneOf, flatten } from '../utils';

export type EpubNodeParser<T = RawBookNode[]> = TreeParser<T, EpubNodeParserEnv>;
export type FullEpubParser = SuccessParser<Stream<XmlTree, EpubNodeParserEnv>, RawBookNode[]>;
export type EpubNodeParserEnv = {
    ds: ParserDiagnoser,
    recursive: TreeParser<RawBookNode[], EpubNodeParserEnv>,
    filePath: string,
};

export function ignoreClass(className: string): EpubNodeParser {
    return elementNode<RawBookNode[], EpubNodeParserEnv>(el =>
        el.attributes.class === className
            ? successValue([])
            : fail()
    );
}

export function ignoreTags(tags: string[]): EpubNodeParser {
    return elementNode<RawBookNode[], EpubNodeParserEnv>(el =>
        equalsToOneOf(el.name, tags)
            ? successValue([])
            : fail()
    );
}

export function fullParser(parser: EpubNodeParser): FullEpubParser {
    return input => {
        const result = some(parser)(input);
        if (result.next.stream.length > 0) {
            input.env.ds.add({ diag: 'extra-nodes-tail', nodes: result.next.stream });
        }

        return success(flatten(result.value), result.next, result.diagnostic);
    };
}

export function buildRef(filePath: string, id: string) {
    return `${filePath}#${id}`;
}

export function logWhileParsing(message?: string, dontLogTree?: boolean) {
    return yieldOne((stream: Stream<XmlTree, EpubNodeParserEnv>) => {
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
