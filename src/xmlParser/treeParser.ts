import { XmlTree, hasChildren, XmlAttributes, XmlTreeElement, isElementTree } from './xmlTree';
import { caseInsensitiveEq, isWhitespaces } from '../utils';
import {
    Result, success, fail, seq, some, translate,
    StreamParser, headParser, makeStream, nextStream, not, Stream, successValue, projectLast, and, HeadFn, expected,
} from '../combinators';
import { Constraint, ConstraintMap, checkObject, checkValue } from '../constraint';
import { compoundDiagnostic } from '../combinators/diagnostics';

export type TreeParser<Out = XmlTree, Env = undefined> = StreamParser<XmlTree, Out, Env>;

// TODO: remove ?
export function elementNode<O, E>(f: HeadFn<XmlTreeElement, O, E>) {
    return headParser((n: XmlTree, env: E) => {
        if (isElementTree(n)) {
            return f(n, env);
        } else {
            return fail({ custom: 'expected-xml-element' });
        }
    });
}

export function xmlElementParser<R, Ch, E = any>(
    name: Constraint<string>,
    expectedAttributes: ConstraintMap<XmlAttributes>,
    children: TreeParser<Ch, E> | null,
    projection: HeadFn<[XmlTreeElement, Ch], R, E>,
): TreeParser<R, E> {
    return input => {
        const parser = children
            ? projectLast(and(xmlName(name), expected(xmlAttributes(expectedAttributes), undefined), xmlChildren(children)))
            : projectLast(and(xmlName(name), expected(xmlAttributes(expectedAttributes), undefined)));
        const elementResult = parser(input);
        if (!elementResult.success) {
            return elementResult;
        }
        const head = input.stream[0];
        if (!head) {
            return fail('empty-stream');
        }

        const proj = projection([head as XmlTreeElement, elementResult.value as Ch], input.env);
        const diag = compoundDiagnostic([proj.diagnostic, elementResult.diagnostic]);
        return proj.success
            ? success(proj.value, nextStream(input), diag)
            : fail(diag);
    };
}

export function xmlName<E = any>(name: Constraint<string>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type === 'element') {
            const check = checkValue(tree.name, name);
            return check
                ? successValue(tree)
                : fail({ custom: 'name-check', name, value: tree.name });
        } else {
            return fail({ custom: 'expected-xml-element' });
        }
    }
    );
}

export function xmlAttributes<E = any>(attrs: ConstraintMap<XmlAttributes>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type === 'element') {
            const checks = checkObject(tree.attributes, attrs);
            if (checks.length === 0) {
                return successValue(tree);
            } else {
                return fail({ custom: 'expected-attrs', checks, tree });
            }
        }
        return fail({ custom: 'expected-xml-element' });
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
            return fail({ custom: 'children: empty input' });
        }
        if (!hasChildren(head)) {
            return fail({ custom: 'children: no children' });
        }

        const result = parser(makeStream(head.children, input.env));
        if (result.success) {
            return success(result.value, nextStream(input), result.diagnostic);
        } else {
            return result;
        }
    };
}

export function xmlParent<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return input => {
        const head = input.stream[0];
        if (head === undefined) {
            return fail({ custom: 'parent: empty input' });
        }
        if (head.parent === undefined) {
            return fail({ custom: 'parent: no parent' });
        }

        const result = parser(makeStream([head.parent], input.env));
        if (result.success) {
            return success(result.value, nextStream(input), result.diagnostic);
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
        return fail({ custom: 'parse path: can\'t parse to empty path' });
    }
    const pc = pathComponents[0];

    const childIndex = input.stream.findIndex(ch =>
        ch.type === 'element' && nameEq(ch.name, pc));
    const child = input.stream[childIndex];
    if (!child) {
        return fail({ custom: `parse path: ${pc}: can't find child` });
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
                return result !== null ? successValue(n.text) : fail({ custom: 'xml-text-rejected' });
            } else {
                return successValue(n.text);
            }
        } else {
            return fail({ custom: 'expected-xml- text' });
        }
    });
}

export const whitespaces = textNode<boolean, any>(text => isWhitespaces(text) ? true : null);

export function whitespaced<T, E>(parser: TreeParser<T, E>): TreeParser<T, E> {
    return translate(
        seq(whitespaces, parser),
        ([_, result]) => result,
    );
}

export function beforeWhitespaces<T, E>(parser: TreeParser<T, E>): TreeParser<T> {
    return translate(
        seq(parser, whitespaces),
        ([result, _]) => result,
    );
}
