import { XmlTree, hasChildren, XmlAttributes, XmlTreeElement, tree2String } from '../xmlStringParser';
import { isWhitespaces, ValueMatcher, ObjectMatcher, matchValue, matchObject, failedKeys } from '../utils';
import {
    Result, yieldNext, reject, seq, some, translate,
    StreamParser, headParser, makeStream, nextStream, not, Stream,
    yieldLast, maybe, ParserDiagnostic, compoundDiagnostic,
} from '../combinators';

export type TreeStream<Env = undefined> = Stream<XmlTree, Env>;
export type TreeParser<Out = XmlTree, Env = undefined> = StreamParser<XmlTree, Out, Env>;

export type XmlElementConstraint = {
    name?: ValueMatcher<string>,
    attrs?: ObjectMatcher<XmlAttributes>,
    expectedAttrs?: ObjectMatcher<XmlAttributes>,
    context?: any,
    keepWhitespaces?: 'trailing' | 'leading' | 'both' | 'none',
    onChildrenTail?: 'ignore' | 'warn' | 'break', // Default is 'warn'
};
export function elem<E = any>(ec: XmlElementConstraint): TreeParser<XmlTreeElement, E> {
    return elementParserImpl(ec);
}

export function elemCh<TC, E = any>(ec: XmlElementConstraint & {
    children: TreeParser<TC, E>,
}): TreeParser<TC, E> {
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
        const childrenTail = ec.onChildrenTail || 'warn';
        let stream = input.stream;
        let head = stream[0];
        if (ec.keepWhitespaces !== 'leading' && ec.keepWhitespaces !== 'both') {
            while (head && head.type === 'text' && isWhitespaces(head.text)) {
                stream = stream.slice(1);
                head = stream[0];
            }
        }

        if (head === undefined || head.type !== 'element') {
            return reject();
        }

        if (!matchValue(head.name, ec.name)) {
            return reject();
        }
        if (ec.attrs) {
            const attrsMatch = matchObject(head.attributes, ec.attrs);
            if (failedKeys(attrsMatch).length > 0) {
                return reject();
            }
        }
        const childrenResult = ec.children && ec.children(makeStream(head.children, input.env));
        if (childrenResult && childrenResult.success === false) {
            return reject();
        }
        const childrenNextStream = childrenResult
            ? childrenResult.next && childrenResult.next.stream
            : head.children;
        if (childrenTail === 'break' && childrenNextStream && childrenNextStream.length > 0) {
            return reject();
        }

        const diags: ParserDiagnostic[] = [];
        if (ec.expectedAttrs) {
            const attrsCheck = failedKeys(matchObject(head.attributes, ec.expectedAttrs));
            if (attrsCheck.length > 0) {
                diags.push({
                    diag: 'unexpected-attrs',
                    reasons: attrsCheck,
                });
            }
        }
        if (childrenResult && childrenResult.diagnostic) {
            diags.push(childrenResult.diagnostic);
        }
        if (childrenTail === 'warn' && childrenNextStream && childrenNextStream.length > 0) {
            diags.push({
                diag: 'expected-parse-all-children',
                tail: childrenNextStream.map(tree2String).join('\n'),
            });
        }

        const diag: ParserDiagnostic = diags.length > 0
            ? {
                context: ec.context || ec.name || 'unspecified',
                xml: tree2String(head),
                diagnostic: compoundDiagnostic(diags),
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

        stream = stream.slice(1);
        if (ec.keepWhitespaces !== 'trailing' && ec.keepWhitespaces !== 'both') {
            head = stream[0];
            while (head && head.type === 'text' && isWhitespaces(head.text)) {
                stream = stream.slice(1);
                head = stream[0];
            }
        }

        return yieldNext(result, makeStream(stream, input.env), diag);
    };
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
