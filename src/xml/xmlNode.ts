import * as parseXmlLib from '@rgrove/parse-xml';
import { assertNever, isWhitespaces } from '../utils';

export type XmlAttributes = {
    [key: string]: string | undefined,
};
export type XmlNodeBase<T extends string> = {
    type: T,
    parent: XmlNode,
};
export type XmlNodeWithParent<T extends string> = XmlNodeBase<T> & {
    parent: XmlNodeWithChildren,
};

export type XmlNode = XmlNodeDocument | XmlNodeElement | XmlNodeText | XmlNodeCData | XmlNodeComment;
export type XmlNodeDocument = {
    type: 'document',
    children: XmlNode[],
    parent: undefined,
};
export type XmlNodeElement = XmlNodeBase<'element'> & {
    name: string,
    attributes: XmlAttributes,
    children: XmlNode[],
};
export type XmlNodeText = XmlNodeBase<'text'> & { text: string };
export type XmlNodeCData = XmlNodeBase<'cdata'> & { text: string };
export type XmlNodeComment = XmlNodeBase<'comment'> & { content: string };

export type XmlNodeType = XmlNode['type'];

export type XmlNodeWithChildren = XmlNodeDocument | XmlNodeElement;
export function hasChildren(node: XmlNode): node is XmlNodeWithChildren {
    return (node.type === 'document' || node.type === 'element') && node.children !== undefined;
}

export function isTextNode(node: XmlNode): node is XmlNodeText {
    return node.type === 'text';
}

export function isElement(node: XmlNode): node is XmlNodeElement {
    return node.type === 'element';
}

export function isComment(node: XmlNode): node is XmlNodeComment {
    return node.type === 'comment';
}

export function isDocument(node: XmlNode): node is XmlNodeDocument {
    return node.type === 'document';
}

export function string2tree(xml: string): XmlNodeDocument | undefined {
    try {
        return parseXmlLib(xml, { preserveComments: false });
    } catch (e) {
        return undefined; // TODO: report parsing errors
    }
}

export function parsePartialXml(xml: string) {
    const documentString = `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
    const document = string2tree(documentString);
    return document
        ? document.children[0]
        : undefined;
}

export function xmlText(text: string, parent?: XmlNodeWithChildren): XmlNodeText {
    return {
        type: 'text',
        text,
        parent: parent!,
    };
}

export function xmlElement(
    name: string,
    children?: XmlNode[],
    attrs?: XmlAttributes,
    parent?: XmlNodeWithChildren,
): XmlNodeElement {
    return {
        type: 'element',
        name: name,
        children: children || [],
        attributes: attrs || {},
        parent: parent!,
    };
}

export function childForPath(node: XmlNode, ...path: string[]): XmlNode | undefined {
    if (path.length === 0) {
        return node;
    }

    if (!hasChildren(node)) {
        return undefined;
    }

    const head = path[0];
    const child = node.children.find(ch => isElement(ch) && sameName(ch.name, head));

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

export function xmlNode2String(n: XmlNode): string {
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
                .map(xmlNode2String)
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
