import { StreamParser, headParser, reject, yieldLast, makeStream } from '../combinators';
import { EpubBook } from '../epub';
import { IntermTop, IntermNodeKey, IntermNode, IntermAttrs } from './intermediateNode';
import { isWhitespaces, ObjectMatcher, matchObject, failedKeys } from '../utils';

export type IntermParserEnv = { filePath: string };
export type IntermParser<T> = StreamParser<IntermNode, T, IntermParserEnv>;
export type IntermProcessor = StreamParser<IntermTop, IntermTop[], IntermParserEnv>;
export type ProcResolver = (epub: EpubBook) => IntermProcessor | undefined;

export type IntermParserArgs = {
    name?: IntermNodeKey,
    attrs?: ObjectMatcher<IntermAttrs>,
};
export function parseInterm({ name, attrs }: IntermParserArgs): IntermParser<IntermNode> {
    return headParser(node => {
        if (name !== undefined && node.interm !== name) {
            return reject();
        } else if (attrs !== undefined) {
            const match = matchObject(node.attrs, attrs);
            if (failedKeys(match).length > 0) {
                return reject();
            }
        }
        return yieldLast(node);
    });
}

export function intermContent<T>(parser: IntermParser<T>): IntermParser<T> {
    return headParser((node, env) => {
        if (node.content && Array.isArray(node.content)) {
            return parser(makeStream(
                node.content as IntermNode[],
                env,
            ));
        } else {
            return reject();
        }
    });
}

export const whitespaces: IntermParser<IntermTop> = headParser(node => {
    if (node.interm === 'pph' && node.content[0]) {
        const ch = node.content[0];
        if (ch.interm === 'text' && isWhitespaces(ch.content)) {
            return yieldLast(node);
        }
    }
    return reject();
});
