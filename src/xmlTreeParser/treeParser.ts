import { XmlTree, hasChildren, XmlAttributes, XmlTreeElement, tree2String } from '../xmlStringParser';
import { caseInsensitiveEq, isWhitespaces } from '../utils';
import {
    Result, yieldNext, reject, seq, some, translate,
    StreamParser, headParser, makeStream, nextStream, not, Stream,
    projectLast, and, HeadFn, expected, yieldLast, diagnosticContext,
    maybe,
    projectFirst,
} from '../combinators';
import { Constraint, ConstraintMap, checkObject, checkValue } from './constraint';
import { compoundDiagnostic } from '../combinators/diagnostics';
import { filterUndefined } from 'booka-common';

export type XmlElementConstraint = {
    name?: Constraint<string>,
    requiredAttributes?: ConstraintMap<XmlAttributes>,
    expectedAttributes?: ConstraintMap<XmlAttributes>,
    context: any,
};
export function xmlElement<E = any>(ec: XmlElementConstraint): TreeParser<XmlTreeElement, E> {
    const name = ec.name === undefined ? undefined
        : xmlName(ec.name);
    const attrs = ec.requiredAttributes === undefined ? undefined
        : xmlAttributes(ec.requiredAttributes);
    const expectedAttrs = ec.expectedAttributes === undefined ? undefined
        : expected(xmlAttributes(ec.expectedAttributes), undefined);
    const all = filterUndefined([name, attrs, expectedAttrs]);

    const element: TreeParser<XmlTreeElement, E> = headParser(el =>
        el.type === 'element'
            ? yieldLast(el)
            : reject()
    );

    const result = projectLast(and(and(...all), element));
    return ec.context === undefined
        ? result
        : diagnosticContext(result, ec.context);
}

export function xmlElementChildren<TC, T, E = any>(ec: XmlElementConstraint & {
    children: TreeParser<TC, E>,
    project: (x: { element: XmlTreeElement, children: TC }) => T,
}): TreeParser<T, E> {
    return translate(
        and(xmlElement(ec), xmlChildren(ec.children)),
        ([el, ch]) => ec.project({
            element: el,
            children: ch,
        }),
    );
}

export type TreeParser<Out = XmlTree, Env = undefined> = StreamParser<XmlTree, Out, Env>;

export function xmlElementParser<R, Ch, E = any>(
    name: Constraint<string>,
    expectedAttributes: ConstraintMap<XmlAttributes>,
    children: TreeParser<Ch, E>,
    projection: HeadFn<[XmlTreeElement, Ch], R, E>,
): TreeParser<R, E> {
    const elParser = diagnosticContext(
        projectLast(and(
            xmlName(name),
            expected(xmlAttributes(expectedAttributes), undefined),
            xmlChildren(children),
        )),
        name,
    );
    return input => {
        const elResult = elParser(input);
        if (!elResult.success) {
            return elResult;
        }
        const head = input.stream[0];
        if (!head) {
            return reject();
        }

        const proj = projection([head as XmlTreeElement, elResult.value], input.env);
        const diag = compoundDiagnostic([proj.diagnostic, elResult.diagnostic]);
        return proj.success
            ? yieldNext(proj.value, nextStream(input), diag)
            : reject(diag);
    };
}

export function xmlName<E = any>(name: Constraint<string>): TreeParser<XmlTreeElement, E> {
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

export function xmlAttributes<E = any>(attrs: ConstraintMap<XmlAttributes>): TreeParser<XmlTreeElement, E> {
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

export function xmlNameAttrs(name: Constraint<string>, attrs: ConstraintMap<XmlAttributes>) {
    return projectLast(and(xmlName(name), xmlAttributes(attrs)));
}

export function xmlNameAttrsChildren<T, E = any>(name: Constraint<string>, attrs: ConstraintMap<XmlAttributes>, childrenParser: TreeParser<T, E>) {
    return projectLast(
        and(xmlName(name), xmlAttributes(attrs), xmlChildren(childrenParser))
    );
}

export function xmlNameChildren<T, E = any>(name: Constraint<string>, childrenParser: TreeParser<T, E>) {
    return projectLast(
        and(xmlName(name), xmlChildren(childrenParser))
    );
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
        ch.type === 'element' && nameEq(ch.name, pc));
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

export function nameEq(n1: string, n2: string): boolean {
    return caseInsensitiveEq(n1, n2);
}

export const extractText = (parser: TreeParser) =>
    projectLast(and(parser, xmlChildren(textNode())));

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

// Whitespaces:

export const whitespaces = textNode<boolean, any>(text => isWhitespaces(text) ? true : null);

export function whitespaced<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return translate(
        seq(maybe(whitespaces), parser, maybe(whitespaces)),
        ([_, result, __]) => result,
    );
}

export function beforeWhitespaces<T, E>(parser: TreeParser<T, E>): TreeParser<T> {
    return translate(
        seq(parser, whitespaces),
        ([result, _]) => result,
    );
}
