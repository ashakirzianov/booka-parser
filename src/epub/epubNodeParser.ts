import { RawBookNode } from 'booka-common';
import { ParserDiagnoser } from '../log';
import {
    XmlTree, TreeParser, elementNode,
} from '../xmlParser';
import {
    SuccessParser, Stream, some, yieldOne, success, successValue, fail,
} from '../combinators';
import { equalsToOneOf, flatten } from '../utils';
import { compoundDiagnostic } from '../combinators/diagnostics';

export type EpubNodeParser<T = RawBookNode[]> = TreeParser<T, EpubNodeParserEnv>;
export type FullEpubParser = SuccessParser<Stream<XmlTree, EpubNodeParserEnv>, RawBookNode[]>;
export type EpubNodeParserEnv = {
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
        const tailDiag = result.next.stream.length > 0
            ? { custom: 'extra-nodes-tail', nodes: result.next.stream }
            : undefined;

        return success(
            flatten(result.value),
            result.next,
            compoundDiagnostic([result.diagnostic, tailDiag]),
        );
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
