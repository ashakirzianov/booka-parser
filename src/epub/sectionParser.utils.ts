import { XmlTree } from '../xmlParser';
import { Stream, alwaysYield, reject, yieldLast, headParser } from '../combinators';
import { equalsToOneOf } from '../utils';
import { EpubTreeParserEnv, EpubElementParser } from './epubBookParser';

export function ignoreClass(className: string): EpubElementParser {
    return headParser(el =>
        el.type === 'element' && el.attributes.class === className
            ? yieldLast([])
            : reject()
    );
}

export function ignoreTags(tags: string[]): EpubElementParser {
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
    return alwaysYield((stream: Stream<XmlTree, EpubTreeParserEnv>) => {
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
