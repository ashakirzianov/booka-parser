import {
    choice, headParser, yieldLast, translate, some,
    makeStream,
} from '../combinators';
import { EpubBook } from '../epub';
import { flatten } from 'booka-common';
import { PreResolver, IntermPreprocessor } from './common';
import { gutenberg } from './pre.gutenberg';
import { fb2epub } from './pre.fb2epub';
import { fictionBookEditor } from './pre.fictionBookEditor';

const allResolvers = [
    gutenberg, fb2epub, fictionBookEditor,
];
export function buildPreprocessor(epub: EpubBook) {
    const hook = resolvePreprocessorHook(epub, allResolvers);
    const single = choice(hook, headParser(interm => yieldLast([interm])));
    const preprocessor = translate(
        some(single),
        (tops, stream) => makeStream(flatten(tops), stream.env),
    );
    return preprocessor;
}

function resolvePreprocessorHook(epub: EpubBook, resolvers: PreResolver[]): IntermPreprocessor {
    for (const res of resolvers) {
        const pre = res(epub);
        if (pre) {
            return pre;
        }
    }

    return interms => yieldLast(interms.stream, {
        diag: 'unexpected-epub',
    });
}

// function checkClass(classToCheck: string | undefined, ctr: Constraint<string>): ParserDiagnostic {
//     const classes = classToCheck
//         ? classToCheck.split(' ')
//         : [undefined];
//     const fails: any[] = [];
//     for (const cls of classes) {
//         const check = checkValue(cls, ctr);
//         if (!check) {
//             fails.push(cls);
//         }
//     }

//     return fails.length === 0
//         ? undefined
//         : {
//             diag: 'unexpected-class',
//             expected: constraintToString(ctr),
//             classes: fails,
//         };
// }
