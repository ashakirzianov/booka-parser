import {
    StreamParser, ParserDiagnostic, compoundDiagnostic, headParser, yieldLast,
} from '../combinators';
import { IntermTop, IntermAttrs, IntermNode, IntermContent } from './intermediateNode';
import { EpubBook } from '../epub';
import { ObjectMatcher, ValueMatcher, matchValue, matchObject } from '../utils';
import { flatten } from 'booka-common';

type Env = { filePath: string };
export type IntermPreprocessor = StreamParser<IntermTop, IntermTop[], Env>;
export type PreResolver = (epub: EpubBook) => IntermPreprocessor | undefined;

export type ProcessorStepResult = {
    node?: IntermTop,
    diag?: ParserDiagnostic,
};
export type ProcessorStep = (interm: IntermTop) => ProcessorStepResult;

export function stepsProcessor(steps: ProcessorStep[]): IntermPreprocessor {
    return headParser(node => {
        const diags: ParserDiagnostic[] = [];
        let input = node;
        for (const step of steps) {
            const result = step(input);
            diags.push(result.diag);
            if (result.node) {
                input = result.node;
            }
        }
        const diag = compoundDiagnostic(diags);

        return yieldLast([input], diag);
    });
}

export function diagnose(diagnoser: (interm: IntermNode) => ParserDiagnostic): ProcessorStep {
    return node => {
        const all = visitNodes(node, diagnoser);
        return {
            diag: compoundDiagnostic(all),
        };
    };
}

export function expectAttrs(interm: IntermNode, expected: ObjectMatcher<IntermAttrs>): ParserDiagnostic {
    const clsDiagnostic = expected.class
        ? expectClass(interm.attrs.class, expected.class)
        : undefined;
    const restMatch = matchObject(interm.attrs, {
        id: null,
        ...expected,
        class: null,
    });
    const fails = Object.entries(restMatch);
    const restDiagnostic = fails.length > 0
        ? {
            diag: 'unexpected-attrs',
            fails: fails,
        }
        : undefined;

    const result = compoundDiagnostic([clsDiagnostic, restDiagnostic]);
    return result
        ? { context: interm.interm, diagnostic: result }
        : undefined;
}

export function expectClass(classToCheck: string | undefined, expected: ValueMatcher<string>): ParserDiagnostic {
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

export function intermToString(interm: IntermContent | IntermNode): string {
    if (typeof interm === 'string') {
        return interm;
    } else if (interm === undefined) {
        return '';
    } else if (Array.isArray(interm)) {
        const content = interm as IntermNode[];
        return content
            .map(intermToString)
            .join('');
    } else {
        return `[${interm.interm}: ${intermToString(interm.content)}]`;
    }
}

export function visitNodes<T>(root: IntermNode, visitor: (n: IntermNode) => T): T[] {
    const results: T[] = [];
    results.push(visitor(root));

    switch (root.interm) {
        case 'text':
        case 'separator':
        case 'ignore':
        case 'image':
            break;
        default:
            const content = root.content as IntermNode[];
            const inside = flatten(content.map(n => visitNodes(n, visitor)));
            results.push(...inside);
            break;
    }

    return results;
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
