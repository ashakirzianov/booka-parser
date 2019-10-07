import { StreamParser, reject, choice, headParser, yieldLast, translate, some, makeStream } from '../combinators';
import { IntermTop } from './intermediateNode';
import { EpubBook } from '../epub';
import { flatten } from 'booka-common';

type Env = { filePath: string };
export type IntermPreprocessor = StreamParser<IntermTop, IntermTop[], Env>;
export type PreResolver = (epub: EpubBook) => IntermPreprocessor | undefined;

export function buildPreprocessor(epub: EpubBook, resolvers: PreResolver[]) {
    const hook = resolvePreprocessorHook(epub, resolvers);
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
