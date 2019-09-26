import { XmlTree, hasChildren, XmlAttributes, XmlTreeElement, tree2String } from '../xmlStringParser';
import { isWhitespaces } from '../utils';
import {
    Result, yieldNext, reject, seq, some, translate,
    StreamParser, headParser, makeStream, nextStream, not, Stream,
    projectLast, and, expected, yieldLast, diagnosticContext,
    maybe,
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
    const name = ec.name === undefined ? undefined
        : xmlName(ec.name);
    const attrs = ec.attrs === undefined ? undefined
        : xmlAttributes(ec.attrs);
    const expectedAttrs = ec.expectedAttrs === undefined ? undefined
        : expected(xmlAttributesFull({ class: null, ...ec.expectedAttrs }), undefined);
    const classes = ec.classes === undefined ? undefined
        : xmlClass(ec.classes);
    const expectedClasses = ec.expectedClasses === undefined ? undefined
        : expected(xmlClass(ec.expectedClasses), undefined);
    const all = filterUndefined([name, attrs, expectedAttrs, classes, expectedClasses]);

    const elParser: TreeParser<XmlTreeElement, E> = headParser(el =>
        el.type === 'element'
            ? yieldLast(el)
            : reject()
    );

    const result = projectLast(and(and(...all), elParser));
    const context = ec.context || ec.name;
    return context === undefined
        ? result
        : diagnosticContext(result, ec.context);
}

export function elemCh<TC, E = any>(ec: XmlElementConstraint & {
    children: TreeParser<TC, E>,
}): TreeParser<TC, E> {
    return projectLast(and(elem(ec), xmlChildren(ec.children)));
}

export function elemChProj<TC, T = TC>(
    ec: XmlElementConstraint & {
        children: TreeParser<TC, any>,
        project: (ch: TC, el: XmlTreeElement) => T,
    },
): TreeParser<T, any> {
    return translate(
        and(elem(ec), xmlChildren(ec.children)),
        ([el, ch]) => ec.project(ch, el),
    );
}

export function elemProj<T, E = any>(
    ec: XmlElementConstraint & {
        project: (el: XmlTreeElement) => T,
    },
): TreeParser<T, E> {
    return translate(
        elem(ec),
        ec.project,
    );
}

function xmlClass<E = any>(ctr: Constraint<string>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type !== 'element') {
            return reject();
        }

        const classes = tree.type === 'element' && tree.attributes.class
            ? tree.attributes.class.split(' ')
            : [undefined];
        const fails: any[] = [];
        for (const cls of classes) {
            const check = checkValue(cls, ctr);
            if (!check) {
                fails.push(cls);
            }
        }

        return fails.length > 0
            ? reject({
                diag: 'unexpected-class',
                expected: constraintToString(ctr),
                classes: fails,
                xml: tree2String(tree),
            })
            : yieldLast(tree);
    });
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
        ([_, result, __]) => result,
    );
}
