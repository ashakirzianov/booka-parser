import {
    ParserDiagnostic, compoundDiagnostic, headParser, yieldLast,
} from '../combinators';
import { IntermTop, IntermNode, IntermContent, IntermSpan } from './intermediateNode';
import { flatten, Semantic, FlagSemantic, assertNever, } from 'booka-common';
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
        node = processNodes(node, (n: IntermNode) => {
            switch (n.interm) {
                case 'link': case 'span': case 'quote': case 'edit':
                case 'italic': case 'bold': case 'small': case 'big': case 'sub': case 'sup':
                case 'image':
                case 'text':
                    return fn(n) as any || n;
                default:
                    return n;
            }
        });
        return { node };
    };
}

export type ProcAttrsResult = {
    semantics?: Semantic[],
    flag?: FlagSemantic['semantic'],
    diag?: ParserDiagnostic,
};
export type ProcAttrsFn = (interm: IntermNode, name: string, value: string) => ProcAttrsResult;
export function processAttrs(fn: ProcAttrsFn): ProcessorStep {
    return node => {
        const diags: ParserDiagnostic[] = [];
        const processed = processNodes(node, n => {
            const results: ProcAttrsResult[] = [];
            for (const [attr, value] of Object.entries(n.attrs)) {
                if (value === undefined) {
                    continue;
                }
                if (attr !== 'class') {
                    results.push(fn(n, attr, value));
                } else {
                    const classes = getClasses(value);
                    for (const cls of classes) {
                        results.push(fn(n, 'class', cls));
                    }
                }
            }
            const semantics: Semantic[] = [];
            for (const result of results) {
                diags.push(result.diag);
                if (result.flag) {
                    semantics.push({ semantic: result.flag });
                }
                if (result.semantics) {
                    semantics.push(...result.semantics);
                }
            }
            n = assignNodeSemantics(n, semantics);

            return n;
        });
        return { node: processed, diag: compoundDiagnostic(diags) };
    };
}

export function assignSemantic(fn: (node: IntermNode) => Semantic | undefined): ProcessorStep {
    return node => {
        const semantic = fn(node);
        return semantic !== undefined
            ? { node: assignNodeSemantics(node, [semantic]) }
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

// TODO: fix for spans
function visitNodes<T>(root: IntermNode, visitor: (n: IntermNode) => T): T[] {
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

function assignNodeSemantics<N extends IntermNode>(node: N, semantics: Semantic[] | undefined): N {
    return semantics !== undefined && semantics.length > 0
        ? {
            ...node,
            semantics: node.semantics
                ? [...node.semantics, ...semantics]
                : semantics,
        }
        : node;
}

function getClasses(cls: string | undefined): string[] {
    return cls !== undefined
        ? cls.split(' ')
        : [];
}

function processNodes<N extends IntermNode>(n: N, fn: <NN extends IntermNode>(n: NN) => NN): N {
    const node = n as IntermNode;
    switch (node.interm) {
        case 'container': case 'pph': case 'header':
        case 'list': case 'item':
        case 'table': case 'row': case 'cell':
        case 'link': case 'span': case 'quote': case 'edit':
        case 'italic': case 'bold': case 'small': case 'big': case 'sub': case 'sup':
            const content = node.content as IntermNode[];
            const result = {
                ...node,
                content: content.map(sub => processNodes(sub, fn)),
            };
            n = result as N;
        case 'text':
        case 'image':
        case 'separator':
        case 'ignore':
            break;
        default:
            assertNever(node);
            break;
    }
    return fn(n);
}
