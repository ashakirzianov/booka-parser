import { filterUndefined, equalsToOneOf } from '../utils';
import {
    andPred, ConstraintValue, Predicate, predSucc, predFail, keyValuePred, expectPred,
} from './predicate';
import {
    tagged,
    projectFirst, and, expected, projectLast, translate,
} from './parserCombinators';
import { headNode, children, XmlParser, textNode } from './treeParser';
import { XmlNodeElement, isElement, xmlNode2String, XmlNode } from './xmlNode';
import { predicate } from './arrayParser';

export const elementNode = <T>(f: (e: XmlNodeElement) => T | null) =>
    headNode(n => isElement(n) ? f(n) : null);

function fromPredicate(pred: ElementPredicate) {
    return tagged(
        predicate(andPred(elemPred(), pred)),
        nodes =>
            `On node: ${nodes[0] && xmlNode2String(nodes[0])}`
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

export const nameChildren = <T>(n: ConstraintValue<string>, ch: XmlParser<T>) =>
    projectLast(and(name(n), expected(attrs({})), children(ch)));
export const nameAttrs = (n: ConstraintValue<string>, attrMap: ConstraintMap) =>
    projectFirst(and(name(n), attrs(attrMap)));
export const nameAttrsChildren = <T>(n: ConstraintValue<string>, attrMap: ConstraintMap, ch: XmlParser<T>) =>
    projectLast(and(name(n), attrs(attrMap), children(ch)));
export const attrsChildren = <T>(attrMap: ConstraintMap, ch: XmlParser<T>) =>
    projectLast(and(attrs(attrMap), children(ch)));

export const extractText = (parser: XmlParser) =>
    projectLast(and(parser, children(textNode())));

// ---- Predicates

function elemPred(): Predicate<XmlNode, XmlNodeElement> {
    return nd => {
        if (isElement(nd)) {
            return predSucc(nd);
        } else {
            return predFail(`Expected xml element, got: ${xmlNode2String(nd)}`);
        }
    };
}

function namePred(n: ConstraintValue<string>): ElementPredicate {
    return keyValuePred<XmlNodeElement>()({
        key: 'name',
        value: n,
    }) as any; // TODO: remove as any
}

type ElementPredicate<T = XmlNodeElement> = Predicate<XmlNodeElement, T>;
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
        return en => equalsToOneOf(en.attributes[key], ...value)
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
            .filter(k => !equalsToOneOf(k, ...keys))
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
    children: XmlParser<TC>,
    translate?: undefined,
};
type ElementDescChildrenTranslate<TC, TT> = {
    children: XmlParser<TC>,
    translate: (x: [XmlNodeElement, TC]) => TT,
};
type ElementDescFns<TC, TT> =
    | ElementDescChildren<TC>
    | ElementDescChildrenTranslate<TC, TT>
    | { children?: undefined, translate?: undefined }
    ;
export type ElementDesc<TC, TT> = Partial<ElementDescBase> & ElementDescFns<TC, TT>;
export function element(desc: Partial<ElementDescBase>): XmlParser<XmlNodeElement>;
export function element<TC>(desc: Partial<ElementDescBase> & ElementDescChildren<TC>): XmlParser<TC>;
export function element<TC, TT>(desc: Partial<ElementDescBase> & ElementDescChildrenTranslate<TC, TT>): XmlParser<TT>;
export function element<TC, TT>(desc: ElementDesc<TC, TT>): XmlParser<TC | TT | XmlNodeElement> {
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
