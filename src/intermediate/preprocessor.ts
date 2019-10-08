import { flatten } from 'booka-common';
import {
    choice, headParser, yieldLast, translate, some,
    makeStream,
} from '../combinators';
import { EpubBook } from '../epub';
import { ProcResolver, IntermProcessor } from './intermParser';
import { gutenberg } from './pre.gutenberg';
import { fb2epub } from './pre.fb2epub';
import { fictionBookEditor } from './pre.fictionBookEditor';

const allProcessors = [
    gutenberg, fb2epub, fictionBookEditor,
];
export function buildPreprocessor(epub: EpubBook) {
    const hook = resolvePreprocessorHook(epub, allProcessors);
    const single = choice(hook, headParser(interm => yieldLast([interm])));
    const preprocessor = translate(
        some(single),
        (tops, stream) => makeStream(flatten(tops), stream.env),
    );
    return preprocessor;
}

function resolvePreprocessorHook(epub: EpubBook, processors: ProcResolver[]): IntermProcessor {
    for (const res of processors) {
        const pre = res(epub);
        if (pre) {
            return pre;
        }
    }

    return interms => yieldLast(interms.stream, {
        diag: 'unexpected-epub',
    });
}
