import { filterUndefined, equalsToOneOf } from '../utils';
import {
    andPred, ConstraintValue, Predicate, predSucc, predFail, keyValuePred, expectPred,
} from './predicate';
import {
    tagged,
    projectFirst, and, expected, projectLast, translate,
} from './parserCombinators';
import { children, TreeParser, textNode } from './treeParser';
import { XmlTreeElement, isElementTree, tree2String, XmlTree } from './xmlTree';
import { headParser, predicate } from './streamParser';

export function elementNode<O, E>(f: (el: XmlTreeElement, env: E) => O | null) {
    return headParser(
        (n: XmlTree, env: E) =>
            isElementTree(n)
                ? f(n, env)
                : null
    );
}

function fromPredicate(pred: ElementPredicate) {
    return tagged(
        predicate(andPred(elemPred(), pred)),
        input =>
            `On node: ${input.stream[0] && tree2String(input.stream[0])}`
    );
}
export const name = (n: ConstraintValue<string>) =>
    fromPredicate(namePred(n));
// TODO: put back expected
// export const attrs = (x: ConstraintMap) =>
//     projectLast(and(
//         expected(fromPredicate(noAttrsExceptPred(Object.keys(x)))),
//         fromPredicate(attrsPred(x)),
//     ));
export const attrs = (x: ConstraintMap) =>
    fromPredicate(attrsPred(x));

export const nameChildren = <T>(n: ConstraintValue<string>, ch: TreeParser<T>) =>
    projectLast(and(name(n), expected(attrs({})), children(ch)));
export const nameAttrs = (n: ConstraintValue<string>, attrMap: ConstraintMap) =>
    projectFirst(and(name(n), attrs(attrMap)));
export const nameAttrsChildren = <T>(n: ConstraintValue<string>, attrMap: ConstraintMap, ch: TreeParser<T>) =>
    projectLast(and(name(n), attrs(attrMap), children(ch)));
export const attrsChildren = <T>(attrMap: ConstraintMap, ch: TreeParser<T>) =>
    projectLast(and(attrs(attrMap), children(ch)));

export const extractText = (parser: TreeParser) =>
    projectLast(and(parser, children(textNode())));

// ---- Predicates

function elemPred(): Predicate<XmlTree, XmlTreeElement> {
    return nd => {
        if (isElementTree(nd)) {
            return predSucc(nd);
        } else {
            return predFail(`Expected xml element, got: ${tree2String(nd)}`);
        }
    };
}

function namePred(n: ConstraintValue<string>): ElementPredicate {
    return keyValuePred<XmlTreeElement>()({
        key: 'name',
        value: n,
    }) as any; // TODO: remove as any
}

type ElementPredicate<T = XmlTreeElement> = Predicate<XmlTreeElement, T>;
type OptString = string | undefined;
type ValueConstraint = OptString | OptString[] | ((v: OptString) => boolean) | true;

type ConstraintMap = {
    [k in string]?: ValueConstraint;
};

type AttributeConstraint = {
    key: string,
    value: ValueConstraint,
};
function attrPred(c: AttributeConstraint): ElementPredicate {
    const { key, value } = c;
    if (typeof value === 'function') {
        return en => value(en.attributes[key])
            ? predSucc(en)
            : predFail(`Unexpected attribute ${key}='${en.attributes[key]}'`);
    } else if (Array.isArray(value)) {
        return en => equalsToOneOf(en.attributes[key], value)
            ? predSucc(en)
            : predFail(`Unexpected attribute ${key}='${en.attributes[key]}', expected values: ${value}`);
    } else if (value === true) {
        return en => en.attributes[key]
            ? predSucc(en)
            : predFail(`Expected attribute ${key} to be set`);
    } else {
        return en => en.attributes[key] === value
            ? predSucc(en)
            : predFail(`Unexpected attribute ${key}='${en.attributes[key]}', expected value: ${value}`);
    }
}

function noAttrsExceptPred(keys: string[]): ElementPredicate {
    return en => {
        const extra = Object.keys(en.attributes)
            .filter(k => !equalsToOneOf(k, keys))
            .map(ue => `${ue}=${en.attributes[ue]}`);
        return extra.length === 0
            ? predSucc(en)
            : predFail(`Unexpected attributes: ${extra}`);
    };
}

function attrsPred(map: ConstraintMap): ElementPredicate {
    const keys = Object.keys(map);
    const constraints = keys
        .map(key => attrPred({ key: key, value: map[key] }));

    return andPred(...constraints);
}

// Junk: Elements sugar

type ElementDescBase = {
    name: string,
    attrs: ConstraintMap,
    expectedAttrs: ConstraintMap,
};
type ElementDescChildren<TC> = {
    children: TreeParser<TC>,
    translate?: undefined,
};
type ElementDescChildrenTranslate<TC, TT> = {
    children: TreeParser<TC>,
    translate: (x: [XmlTreeElement, TC]) => TT,
};
type ElementDescFns<TC, TT> =
    | ElementDescChildren<TC>
    | ElementDescChildrenTranslate<TC, TT>
    | { children?: undefined, translate?: undefined }
    ;
export type ElementDesc<TC, TT> = Partial<ElementDescBase> & ElementDescFns<TC, TT>;
export function element(desc: Partial<ElementDescBase>): TreeParser<XmlTreeElement>;
export function element<TC>(desc: Partial<ElementDescBase> & ElementDescChildren<TC>): TreeParser<TC>;
export function element<TC, TT>(desc: Partial<ElementDescBase> & ElementDescChildrenTranslate<TC, TT>): TreeParser<TT>;
export function element<TC, TT>(desc: ElementDesc<TC, TT>): TreeParser<TC | TT | XmlTreeElement> {
    const pred = descPred(desc);
    const predParser = predicate(pred);
    if (desc.children) {
        const ch = desc.children;
        const withChildren = and(predParser, children(desc.children));
        return desc['translate']
            ? translate(withChildren, desc['translate'])
            : projectLast(withChildren);
    } else {
        return predParser;
    }
}

function descPred(desc: Partial<ElementDesc<any, any>>) {
    const nameP = desc.name === undefined ? undefined : namePred(desc.name);
    const attrsParser = desc.attrs && attrsPred(desc.attrs);
    const expectedAttrsParser = desc.expectedAttrs && expectPred(attrsPred(desc.expectedAttrs));
    const allKeys = Object.keys(desc.attrs || {})
        .concat(Object.keys(desc.expectedAttrs || {}));
    const notSet = allKeys.length > 0
        ? noAttrsExceptPred(allKeys)
        : undefined;
    const ps = filterUndefined([nameP, attrsParser, expectedAttrsParser, notSet]);
    const pred = andPred(elemPred(), ...ps);

    return pred;
}
