import {
    ParserDiagnostic, compoundDiagnostic, headParser, yieldLast,
} from '../combinators';
import { IntermTop, IntermAttrs, IntermNode, IntermContent, IntermNodeKey, IntermSpan } from './intermediateNode';
import { ObjectMatcher, ValueMatcher, matchValue, matchObject, CompoundMatcher } from '../utils';
import { flatten, Semantic, FlagSemantic, } from 'booka-common';
import { IntermProcessor } from './intermParser';

export type ProcessorStepResult = {
    node?: IntermTop,
    diag?: ParserDiagnostic,
};
export type ProcessorStep = (interm: IntermTop) => ProcessorStepResult;

export function stepsProcessor(steps: ProcessorStep[]): IntermProcessor {
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

export function processSpan(fn: (span: IntermSpan) => IntermSpan | undefined): ProcessorStep {
    return node => {
        return {
            node: processContainedSpans(node, s => fn(s) || s),
        };
    };
}

export function assignSemantic(fn: (node: IntermNode) => Semantic | undefined): ProcessorStep {
    return node => {
        const semantic = fn(node);
        return semantic !== undefined
            ? { node: assignNodeSemantic(node, semantic) }
            : {};
    };
}

export function assignSemanticForClass(cls: string, semantic: Semantic): ProcessorStep {
    return assignSemantic(
        node =>
            hasClass(node, cls)
                ? semantic
                : undefined,
    );
}

export function flagClass(cls: string, semanticKey: FlagSemantic['semantic']): ProcessorStep {
    return assignSemanticForClass(cls, { semantic: semanticKey });
}

export function markAsJunk(cls: string): ProcessorStep {
    return flagClass(cls, 'junk');
}

export function diagnose(diagnoser: (interm: IntermNode) => ParserDiagnostic): ProcessorStep {
    return node => {
        const all = visitNodes(node, diagnoser);
        return {
            diag: compoundDiagnostic(all),
        };
    };
}

export type ExpectedAttrs = {
    [k: string]: ValueMatcher<string>,
    class: CompoundMatcher<string>,
};
export type ExpectedAttrsMap = {
    [k in IntermNodeKey]: ExpectedAttrs;
};

export function expectAttrsMap(expectedAttrsMap: ExpectedAttrsMap) {
    return diagnose(node => {
        const expected = expectedAttrsMap[node.interm];
        return expected
            ? expectAttrs(node, expected)
            : undefined;
    });
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
    const fails = Object.entries(restMatch).filter(([_, { value }]) => value !== undefined);
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
    const classes = getClasses(classToCheck);
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

export function hasClass(node: IntermNode, toCheck: string): boolean {
    return getClasses(node.attrs.class)
        .some(c => c === toCheck);
}

function assignNodeSemantic<N extends IntermNode>(node: N, semantic: Semantic): N {
    return {
        ...node,
        semantics: node.semantics
            ? [...node.semantics, semantic]
            : [semantic],
    };
}

function getClasses(cls: string | undefined): string[] {
    return cls !== undefined
        ? cls.split(' ')
        : [];
}

function processContainedSpans<N extends IntermNode>(node: N, fn: (span: IntermSpan) => IntermSpan): N {
    const n = node as IntermNode;
    switch (n.interm) {
        case 'pph':
        case 'header':
            return {
                ...node,
                content: n.content.map(fn),
            };
        case 'list':
            return {
                ...node,
                content: n.content.map(sub => processContainedSpans(sub, fn)),
            };
        case 'item':
            return {
                ...node,
                content: n.content.map(sub => processContainedSpans(sub, fn)),
            };
        case 'table':
            return {
                ...node,
                content: n.content.map(sub => processContainedSpans(sub, fn)),
            };
        case 'row':
            return {
                ...node,
                content: n.content.map(sub => processContainedSpans(sub, fn)),
            };
        case 'cell':
            return {
                ...node,
                content: n.content.map(sub => processContainedSpans(sub, fn)),
            };
        case 'container':
            return {
                ...node,
                content: n.content.map(sub => processContainedSpans(sub, fn)),
            };
        case 'image':
        case 'separator':
        case 'ignore':
            return node;
        default:
            return fn(n) as N;
    }
}
