import { StreamParser, ParserDiagnostic, compoundDiagnostic } from '../combinators';
import { IntermTop, IntermAttrs, IntermNode, IntermContent } from './intermediateNode';
import { EpubBook } from '../epub';
import { ObjectMatcher, ValueMatcher, matchValue, matchObject } from '../utils';

type Env = { filePath: string };
export type IntermPreprocessor = StreamParser<IntermTop, IntermTop[], Env>;
export type PreResolver = (epub: EpubBook) => IntermPreprocessor | undefined;

export function diagnoseInterm(node: IntermNode, diagnoser: (node: IntermNode) => ParserDiagnostic): ParserDiagnostic {
    const diags: ParserDiagnostic[] = [];
    diags.push(diagnoser(node));

    switch (node.interm) {
        case 'text':
        case 'separator':
        case 'ignore':
        case 'image':
            break;
        default:
            const content = node.content as IntermNode[];
            const inside = content.map((x: any) => diagnoser(x));
            diags.push(...inside);
            break;
    }

    return compoundDiagnostic(diags);
}

export function diagnoseAttrs(attrs: IntermAttrs, expected: ObjectMatcher<IntermAttrs>): ParserDiagnostic {
    const clsDiagnostic = expected.class
        ? diagnoseClass(attrs.class, expected.class)
        : undefined;
    const restMatch = matchObject(attrs, {
        ...expected,
        class: null,
    });
    const fails = Object.values(restMatch);
    const restDiagnostic = fails.length > 0
        ? {
            diag: 'unexpected-attrs',
            fails: fails,
        }
        : undefined;

    return compoundDiagnostic([clsDiagnostic, restDiagnostic]);
}

export function diagnoseClass(classToCheck: string | undefined, expected: ValueMatcher<string>): ParserDiagnostic {
    const classes = classToCheck
        ? classToCheck.split(' ')
        : [undefined];
    const fails: any[] = [];
    for (const cls of classes) {
        const check = matchValue(cls, expected);
        if (!check) {
            fails.push(cls);
        }
    }

    return fails.length === 0
        ? undefined
        : {
            diag: 'unexpected-class',
            classes: fails,
        };
}

// export type IntermParser<T extends IntermContent> = StreamParser<T, T, Env>;
// type PrepNodeParserArgs<K extends IntermNodeKey> = {
//     name: K,
//     expectedAttrs?: ObjectMatcher<IntermAttrs>,
//     children?: IntermParser<IntermContentForKey<K>>,
//     project: (node: IntermForKey<K>, content: Array<IntermContentForKey<K>>) => IntermForKey<K>,
// };
// export function intermParser<K extends IntermNodeKey>(args: PrepNodeParserArgs<K>): IntermParser<IntermForKey<K>> {
//     return headParser(node => {
//         if (node.interm !== args.name) {
//             return reject();
//         }

//         return yieldLast(node);
//     });
// }
