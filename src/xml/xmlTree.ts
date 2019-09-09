import * as parseXmlLib from '@rgrove/parse-xml';
import { assertNever, isWhitespaces } from '../utils';
import { Result, success } from '../combinators';

export type XmlAttributes = {
    [key: string]: string | undefined,
};
export type XmlTreeBase<T extends string> = {
    type: T,
    parent: XmlTree,
    name?: string,
};
export type XmlTreeWithParent<T extends string> = XmlTreeBase<T> & {
    parent: XmlTreeWithChildren,
};

export type XmlTree = XmlTreeDocument | XmlTreeElement | XmlTreeText | XmlTreeCData | XmlTreeComment;
export type XmlTreeDocument = {
    type: 'document',
    children: XmlTree[],
    parent: undefined,
};
export type XmlTreeElement = XmlTreeBase<'element'> & {
    name: string,
    attributes: XmlAttributes,
    children: XmlTree[],
};
export type XmlTreeText = XmlTreeBase<'text'> & { text: string };
export type XmlTreeCData = XmlTreeBase<'cdata'> & { text: string };
export type XmlTreeComment = XmlTreeBase<'comment'> & { content: string };

export type XmlTreeType = XmlTree['type'];

export type XmlTreeWithChildren = XmlTreeDocument | XmlTreeElement;
export function hasChildren(tree: XmlTree): tree is XmlTreeWithChildren {
    return (tree.type === 'document' || tree.type === 'element') && tree.children !== undefined;
}

export function isTextTree(tree: XmlTree): tree is XmlTreeText {
    return tree.type === 'text';
}

export function isElementTree(tree: XmlTree): tree is XmlTreeElement {
    return tree.type === 'element';
}

export function isCommentTree(tree: XmlTree): tree is XmlTreeComment {
    return tree.type === 'comment';
}

export function isDocumentTree(tree: XmlTree): tree is XmlTreeDocument {
    return tree.type === 'document';
}

export function xmlStringParser(xmlString: string): Result<string, XmlTreeDocument> {
    try {
        const tree = parseXmlLib(xmlString, { preserveComments: false });
        return success(tree, '');
    } catch (e) {
        return fail(e);
    }
}

export function xmlText(text: string, parent?: XmlTreeWithChildren): XmlTreeText {
    return {
        type: 'text',
        text,
        parent: parent!,
    };
}

export function xmlElement(
    name: string,
    children?: XmlTree[],
    attrs?: XmlAttributes,
    parent?: XmlTreeWithChildren,
): XmlTreeElement {
    return {
        type: 'element',
        name: name,
        children: children || [],
        attributes: attrs || {},
        parent: parent!,
    };
}

export function childForPath(tree: XmlTree, ...path: string[]): XmlTree | undefined {
    if (path.length === 0) {
        return tree;
    }

    if (!hasChildren(tree)) {
        return undefined;
    }

    const head = path[0];
    const child = tree.children.find(ch => isElementTree(ch) && sameName(ch.name, head));

    return child
        ? childForPath(child, ...path.slice(1))
        : undefined;
}

export function sameName(n1: string, n2: string) {
    return n1.toUpperCase() === n2.toUpperCase();
}

export function attributesToString(attr: XmlAttributes): string {
    const result = Object.keys(attr)
        .map(k => attr[k] ? `${k}="${attr[k]}"` : k)
        .join(' ');

    return result;
}

export function tree2String(n: XmlTree): string {
    switch (n.type) {
        case 'element':
        case 'document':
            const name = n.type === 'element'
                ? n.name
                : 'document';
            const attrs = n.type === 'element'
                ? attributesToString(n.attributes)
                : '';
            const attrsStr = attrs.length > 0 ? ' ' + attrs : '';
            const chs = n.children
                .map(tree2String)
                .reduce((all, cur) => all + cur, '');
            return chs.length > 0
                ? `<${name}${attrsStr}>${chs}</${name}>`
                : `<${name}${attrsStr}/>`;
        case 'text':
            return isWhitespaces(n.text)
                ? '*' + n.text
                : n.text;
        case 'comment':
            return `<!--${n.content}-->`;
        case 'cdata':
            return '<![CDATA[ ... ]]>';
        default:
            return assertNever(n);
    }
}
