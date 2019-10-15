import * as parseXmlLib from '@rgrove/parse-xml';
import { assertNever } from 'booka-common';
import { yieldLast, FullParser, reject } from '../combinators';
import { isWhitespaces } from '../utils';

export type XmlStringParserInput = {
    xmlString: string,
    preserveComments?: boolean,
    removeTrailingWhitespaces?: boolean,
};
export type XmlStringParser = FullParser<XmlStringParserInput, XmlDocument>;

export const xmlStringParser: XmlStringParser = input => {
    try {
        let tree = parseXmlLib(input.xmlString, {
            preserveComments: input.preserveComments || false,
            ignoreUndefinedEntities: true,
        });
        if (input.removeTrailingWhitespaces) {
            tree = {
                ...tree,
                children: removeTrailingWhitespaces(tree.children),
            };
        }
        return yieldLast(tree);
    } catch (e) {
        return reject({ diag: 'exception', e });
    }
};

export type XmlAttributes = {
    [key: string]: string | undefined,
};
export type XmlBase<T extends string> = {
    type: T,
    parent: Xml,
};
type NoName = { name?: undefined };
export type XmlWithParent<T extends string> = XmlBase<T> & {
    parent: XmlWithChildren,
};

export type Xml = XmlDocument | XmlElement | XmlText | XmlCData | XmlComment;
export type XmlDocument = {
    type: 'document',
    children: Xml[],
    parent: undefined,
} & NoName;
export type XmlElement = XmlBase<'element'> & {
    name: string,
    attributes: XmlAttributes,
    children: Xml[],
};
export type XmlText = XmlBase<'text'> & { text: string } & NoName;
export type XmlCData = XmlBase<'cdata'> & { text: string } & NoName;
export type XmlComment = XmlBase<'comment'> & { content: string } & NoName;

export type XmlType = Xml['type'];

export type XmlWithChildren = XmlDocument | XmlElement;
export function hasChildren(tree: Xml): tree is XmlWithChildren {
    return (tree.type === 'document' || tree.type === 'element') && tree.children !== undefined;
}

export function isXmlText(xml: Xml): xml is XmlText {
    return xml.type === 'text';
}

export function isXmlElement(xml: Xml): xml is XmlElement {
    return xml.type === 'element';
}

export function isXmlComment(xml: Xml): xml is XmlComment {
    return xml.type === 'comment';
}

export function isXmlDocument(xml: Xml): xml is XmlDocument {
    return xml.type === 'document';
}

export function makeXmlText(text: string, parent?: XmlWithChildren): XmlText {
    return {
        type: 'text',
        text,
        parent: parent!,
    };
}

export function makeXmlElement(
    name: string,
    children?: Xml[],
    attrs?: XmlAttributes,
    parent?: XmlWithChildren,
): XmlElement {
    return {
        type: 'element',
        name: name,
        children: children || [],
        attributes: attrs || {},
        parent: parent!,
    };
}

export function childForPath(xml: Xml, ...path: string[]): Xml | undefined {
    if (path.length === 0) {
        return xml;
    }

    if (!hasChildren(xml)) {
        return undefined;
    }

    const head = path[0];
    const child = xml.children.find(ch => isXmlElement(ch) && sameName(ch.name, head));

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

export function xml2string(xml: Xml, depth: number = 1): string {
    switch (xml.type) {
        case 'element':
        case 'document':
            const name = xml.name || 'document';
            const attrs = xml.type === 'element'
                ? attributesToString(xml.attributes)
                : '';
            const attrsStr = attrs.length > 0 ? ' ' + attrs : '';
            const chs = depth !== 0
                ? xml.children
                    .map(ch => xml2string(ch, depth - 1))
                    .join('')
                : '';
            return chs.length > 0
                ? `<${name}${attrsStr}>${chs}</${name}>`
                : `<${name}${attrsStr}/>`;
        case 'text':
            // return isWhitespaces(n.text)
            //     ? '*' + n.text
            //     : n.text;
            return xml.text;
        case 'comment':
            return `<!--${xml.content}-->`;
        case 'cdata':
            return '<![CDATA[ ... ]]>';
        default:
            assertNever(xml);
            return '<!>';
    }
}

export function removeTrailingWhitespaces(xmls: Xml[]): Xml[] {
    const head = xmls[0];
    if (!head) {
        return xmls;
    }

    if (head.type === 'text' && isWhitespaces(head.text)) {
        return removeTrailingWhitespaces(xmls.slice(1));
    }

    const result: Xml[] = [];
    for (const tree of xmls) {
        if (tree.type === 'element' || tree.type === 'document') {
            result.push({
                ...tree,
                children: removeTrailingWhitespaces(tree.children),
            });
        } else {
            result.push(tree);
        }
    }

    return result;
}

export function extractAllText(xml: Xml): string {
    switch (xml.type) {
        case 'text':
            return xml.text.trim();
        case 'document':
        case 'element':
            return xml.children
                .map(extractAllText)
                .join('');
        case 'comment':
        case 'cdata':
            return '';
        default:
            assertNever(xml);
            return '';
    }
}
