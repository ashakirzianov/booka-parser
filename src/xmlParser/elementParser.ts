import {
    and, projectLast, headParser, HeadFn, successValue, fail,
} from '../combinators';
import { children, TreeParser, textNode } from './treeParser';
import { XmlTreeElement, isElementTree, XmlTree, XmlAttributes } from './xmlTree';
import { ConstraintMap, checkObject, Constraint, checkValue } from '../constraint';

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
        and(xmlName(name), xmlAttributes(attrs), children(childrenParser))
    );
}

export function xmlNameChildren<T, E = any>(name: Constraint<string>, childrenParser: TreeParser<T, E>) {
    return projectLast(
        and(xmlName(name), children(childrenParser))
    );
}

export const extractText = (parser: TreeParser) =>
    projectLast(and(parser, children(textNode())));
