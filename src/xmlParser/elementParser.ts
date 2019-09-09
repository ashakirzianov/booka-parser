import {
    and, projectLast, headParser,
} from '../combinators';
import { children, TreeParser, textNode } from './treeParser';
import { XmlTreeElement, isElementTree, XmlTree, XmlAttributes } from './xmlTree';
import { ConstraintMap, checkObject, Constraint, checkValue } from '../constraint';

// TODO: remove ?
export function elementNode<O, E>(f: (el: XmlTreeElement, env: E) => O | null) {
    return headParser(
        (n: XmlTree, env: E) =>
            isElementTree(n)
                ? f(n, env)
                : null
    );
}

export function xmlName<E = any>(name: Constraint<string>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type === 'element') {
            const check = checkValue(tree.name, name);
            return check
                ? tree
                : null;
        } else {
            return null;
        }
    }
    );
}

export function xmlAttributes<E = any>(attrs: ConstraintMap<XmlAttributes>): TreeParser<XmlTreeElement, E> {
    return headParser(tree => {
        if (tree.type === 'element') {
            const checks = checkObject(tree.attributes, attrs);
            if (checks.length === 0) {
                return tree;
            }
            // TODO: log check results
        }
        return null;
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
