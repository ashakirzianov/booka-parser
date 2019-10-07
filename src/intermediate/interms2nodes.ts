import { flatten, BookContentNode } from 'booka-common';
import {
    StreamParser, some, choice, headParser, yieldLast,
    translate, reject, pipe, makeStream,
} from '../combinators';
import { IntermTop, } from './intermediateNode';
import { EpubBook } from '../epub/epubBook';
import { convertInterms } from './convertInterms';

export function buildInterms2nodes(epub: EpubBook): StreamParser<IntermTop, BookContentNode[], Env> {
    const hook = resolvePreprocessorHook(epub);
    const single = choice(hook, headParser(interm => yieldLast([interm])));
    const preprocessor = translate(
        some(single),
        (tops, stream) => makeStream(flatten(tops), stream.env),
    );

    return pipe(
        preprocessor,
        stream => {
            const result = convertInterms({
                interms: stream.stream,
                filePath: stream.env.filePath,
            });
            return result;
        },
    );
}

type Env = { filePath: string };
type IntermPreprocessor = StreamParser<IntermTop, IntermTop[], Env>;
const defaultPrep: IntermPreprocessor = () => reject();
function resolvePreprocessorHook(epub: EpubBook): IntermPreprocessor {
    return defaultPrep;
}
