import { RawBookNode } from 'booka-common';
import { XmlTree, elementNode } from '../xmlParser';
import { Stream, alwaysYield, yieldOne, reject } from '../combinators';
import { equalsToOneOf } from '../utils';
import { EpubNodeParserEnv, EpubNodeParser } from './epubBookParser';

export function ignoreClass(className: string): EpubNodeParser {
    return elementNode<RawBookNode[], EpubNodeParserEnv>(el =>
        el.attributes.class === className
            ? yieldOne([])
            : reject()
    );
}

export function ignoreTags(tags: string[]): EpubNodeParser {
    return elementNode<RawBookNode[], EpubNodeParserEnv>(el =>
        equalsToOneOf(el.name, tags)
            ? yieldOne([])
            : reject()
    );
}

export function buildRef(filePath: string, id: string) {
    return `${filePath}#${id}`;
}

export function logWhileParsing(message?: string, dontLogTree?: boolean) {
    return alwaysYield((stream: Stream<XmlTree, EpubNodeParserEnv>) => {
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
