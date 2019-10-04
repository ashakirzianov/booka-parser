import { XmlTree, hasChildren, XmlAttributes, XmlTreeElement, tree2String } from '../xmlStringParser';
import { isWhitespaces } from '../utils';
import {
    Result, yieldNext, reject, seq, some, translate,
    StreamParser, headParser, makeStream, nextStream, not, Stream,
    projectLast, and, expected, yieldLast, diagnosticContext,
    maybe,
    ParserDiagnostic,
    compoundDiagnostic,
} from '../combinators';
import { Constraint, ConstraintMap, checkObject, checkValue, checkObjectFull, constraintToString } from './constraint';
import { filterUndefined } from 'booka-common';

export type TreeParser<Out = XmlTree, Env = undefined> = StreamParser<XmlTree, Out, Env>;

export type XmlElementConstraint = {
    name?: Constraint<string>,
    attrs?: ConstraintMap<XmlAttributes>,
    expectedAttrs?: ConstraintMap<XmlAttributes>,
    classes?: Constraint<string>,
    expectedClasses?: Constraint<string>,
    context?: any,
};
export function elem<E = any>(ec: XmlElementConstraint): TreeParser<XmlTreeElement, E> {
    return elementParserImpl(ec);
}

export function elemCh<TC, E = any>(ec: XmlElementConstraint & {
    children: TreeParser<TC, E>,
}): TreeParser<TC, E> {
    const context = ec.context || ec.name || 'undefined';
    return elementParserImpl(ec);
}

export function elemChProj<TC, T = TC>(
    ec: XmlElementConstraint & {
        children: TreeParser<TC, any>,
        project: (ch: TC, el: XmlTreeElement) => T,
    },
): TreeParser<T, any> {
    return elementParserImpl(ec);
}

export function elemProj<T, E = any>(
    ec: XmlElementConstraint & {
        project: (el: XmlTreeElement) => T,
    },
): TreeParser<T, E> {
    return elementParserImpl(ec);
}

function elementParserImpl<TC, T = TC>(
    ec: XmlElementConstraint & {
        children?: TreeParser<TC, any>,
        project?: (chOrEl: any, el?: any) => T,
    },
): TreeParser<any, any> {
    return function elemParser(input) {
        const head = input.stream[0];
        if (head === undefined || head.type !== 'element') {
            return reject();
        }

        if (!checkValue(head.name, ec.name)) {
            return reject();
        }
        const cls = head.attributes.class;
        if (ec.classes && checkClass(cls, ec.classes)) {
            return reject();
        }
        if (ec.attrs && checkObject(head.attributes, ec.attrs).length > 0) {
            return reject();
        }
        const childrenResult = ec.children && ec.children(makeStream(head.children, input.env));
        if (childrenResult && childrenResult.success === false) {
            return reject();
        }

        const expectedClasses = ec.expectedClasses && checkClass(cls, ec.expectedClasses);
        const expectedAttrs = ec.expectedAttrs && checkObject(head.attributes, ec.expectedAttrs);

        let diag = compoundDiagnostic([
            expectedClasses || undefined,
            expectedAttrs && expectedAttrs.length > 0
                ? { diag: 'unexpected-attrs', reasons: expectedAttrs }
                : undefined,
            childrenResult && childrenResult.diagnostic,
        ]);
        diag = diag !== undefined
            ? {
                context: ec.context || ec.name || 'unspecified',
                xml: tree2String(head),
                ...diag,
            }
            : undefined;

        const result = ec.project
            ? (childrenResult
                ? ec.project(childrenResult.value, head)
                : ec.project(head)
            )
            : (childrenResult
                ? childrenResult.value
                : head
            );

        return yieldNext(result, nextStream(input), diag);
    };
}

function xmlClass<E = any>(ctr: Constraint<string>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type !== 'element') {
            return reject();
        }

        const diag = checkClass(tree.attributes.class, ctr);

        return diag !== undefined
            ? reject({
                ...diag,
                xml: tree2String(tree),
            })
            : yieldLast(tree);
    });
}

function checkClass(classToCheck: string | undefined, ctr: Constraint<string>): ParserDiagnostic {
    const classes = classToCheck
        ? classToCheck.split(' ')
        : [undefined];
    const fails: any[] = [];
    for (const cls of classes) {
        const check = checkValue(cls, ctr);
        if (!check) {
            fails.push(cls);
        }
    }

    return fails.length === 0
        ? undefined
        : {
            diag: 'unexpected-class',
            expected: constraintToString(ctr),
            classes: fails,
        };
}

function xmlName<E = any>(name: Constraint<string>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type === 'element') {
            const check = checkValue(tree.name, name);
            return check
                ? yieldLast(tree)
                : reject({ diag: 'name-check', name, value: tree.name });
        } else {
            return reject({ diag: 'expected-xml-element' });
        }
    }
    );
}

function xmlAttributes<E = any>(attrs: ConstraintMap<XmlAttributes>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type === 'element') {
            const checks = checkObject(tree.attributes, attrs);
            if (checks.length === 0) {
                return yieldLast(tree);
            } else {
                return reject({ diag: 'expected-attrs', checks, xml: tree2String(tree) });
            }
        }
        return reject({ diag: 'expected-xml-element' });
    });
}

function xmlAttributesFull<E = any>(attrs: ConstraintMap<XmlAttributes>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type === 'element') {
            const checks = checkObjectFull(tree.attributes, attrs);
            if (checks.length === 0) {
                return yieldLast(tree);
            } else {
                return reject({ diag: 'expected-attrs', checks, xml: tree2String(tree) });
            }
        }
        return reject({ diag: 'expected-xml-element' });
    });
}

export function xmlChildren<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return reject({ diag: 'children: empty input' });
        }
        if (!hasChildren(head)) {
            return reject({ diag: 'children: no children' });
        }

        const result = parser(makeStream(head.children, input.env));
        if (result.success) {
            return yieldNext(result.value, nextStream(input), result.diagnostic);
        } else {
            return result;
        }
    };
}

export function xmlParent<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return reject({ diag: 'parent: empty input' });
        }
        if (head.parent === undefined) {
            return reject({ diag: 'parent: no parent' });
        }

        const result = parser(makeStream([head.parent], input.env));
        if (result.success) {
            return yieldNext(result.value, nextStream(input), result.diagnostic);
        } else {
            return result;
        }
    };
}

export function between<T, E>(left: TreeParser<any, E>, right: TreeParser<any, E>, inside: TreeParser<T, E>): TreeParser<T, E> {
    return input => {
        const result = seq(
            some(not(left)),
            left,
            some(not(right)),
            right,
        )(input);

        return result.success
            ? inside(makeStream(result.value[2], input.env))
            : result
            ;
    };
}

function parsePathHelper<T, E>(pathComponents: string[], then: TreeParser<T, E>, input: Stream<XmlTree, E>): Result<Stream<XmlTree, E>, T> {
    if (pathComponents.length === 0) {
        return reject({ diag: 'parse path: can\'t parse to empty path' });
    }
    const pc = pathComponents[0];

    const childIndex = input.stream.findIndex(ch =>
        ch.type === 'element' && ch.name === pc);
    const child = input.stream[childIndex];
    if (!child) {
        return reject({ diag: `parse path: ${pc}: can't find child` });
    }

    if (pathComponents.length < 2) {
        const next = makeStream(input.stream.slice(childIndex), input.env);
        const result = then(next);
        return result;
    }

    const nextNodes = hasChildren(child) ? child.children : [];
    const nextInput = makeStream(nextNodes, input.env);

    return parsePathHelper(pathComponents.slice(1), then, nextInput);
}

export function path<T, E>(paths: string[], then: TreeParser<T, E>): TreeParser<T, E> {
    return input => parsePathHelper(paths, then, input);
}

// Text:

export function textNode<T, E = any>(f: (text: string) => T | null): TreeParser<T, E>;
export function textNode<E = any>(): TreeParser<string, E>;
export function textNode<T, E>(f?: (text: string) => T | null): TreeParser<T | string, E> {
    return headParser((n: XmlTree) => {
        if (n.type === 'text') {
            if (f) {
                const result = f(n.text);
                return result !== null
                    ? yieldLast(result)
                    : reject({ diag: 'xml-text-rejected' });
            } else {
                return yieldLast(n.text as any);
            }
        } else {
            return reject({ diag: 'expected-xml- text' });
        }
    });
}

export const whitespaces = textNode<boolean, any>(text => isWhitespaces(text) ? true : null);

export function whitespaced<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return translate(
        seq(maybe(whitespaces), parser, maybe(whitespaces)),
        ([_, result, __]) => {
            return result;
        },
    );
}
