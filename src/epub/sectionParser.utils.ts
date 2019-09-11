import { XmlTree } from '../xmlParser';
import { Stream, alwaysYield, reject, yieldLast, headParser } from '../combinators';
import { equalsToOneOf } from '../utils';
import { EpubNodeParserEnv, EpubNodeParser } from './epubBookParser';

export function ignoreClass(className: string): EpubNodeParser {
    return headParser(el =>
        el.type === 'element' && el.attributes.class === className
            ? yieldLast([])
            : reject()
    );
}

export function ignoreTags(tags: string[]): EpubNodeParser {
    return headParser(el =>
        equalsToOneOf(el.name, tags)
            ? yieldLast([])
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
