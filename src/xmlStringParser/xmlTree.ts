import * as parseXmlLib from '@rgrove/parse-xml';
import { assertNever } from 'booka-common';
import { yieldLast, FullParser, reject } from '../combinators';
import { isWhitespaces } from '../utils';

export type XmlStringParserInput = {
    xmlString: string,
    preserveComments?: boolean,
    removeTrailingWhitespaces?: boolean,
};
export type XmlStringParser = FullParser<XmlStringParserInput, XmlTreeDocument>;

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
    name?: string,
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

export function xmlText(text: string, parent?: XmlTreeWithChildren): XmlTreeText {
    return {
        type: 'text',
        text,
        parent: parent!,
    };
}

export function makeXmlElement(
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

export function tree2String(n: XmlTree, depth: number = 0): string {
    switch (n.type) {
        case 'element':
        case 'document':
            const name = n.name || 'document';
            const attrs = n.type === 'element'
                ? attributesToString(n.attributes)
                : '';
            const attrsStr = attrs.length > 0 ? ' ' + attrs : '';
            const chs = depth !== 0
                ? n.children
                    .map(ch => tree2String(ch, depth - 1))
                    .join('')
                : '';
            return chs.length > 0
                ? `<${name}${attrsStr}>${chs}</${name}>`
                : `<${name}${attrsStr}/>`;
        case 'text':
            // return isWhitespaces(n.text)
            //     ? '*' + n.text
            //     : n.text;
            return n.text;
        case 'comment':
            return `<!--${n.content}-->`;
        case 'cdata':
            return '<![CDATA[ ... ]]>';
        default:
            assertNever(n);
            return '<!>';
    }
}

export function removeTrailingWhitespaces(trees: XmlTree[]): XmlTree[] {
    const head = trees[0];
    if (!head) {
        return trees;
    }

    if (head.type === 'text' && isWhitespaces(head.text)) {
        return removeTrailingWhitespaces(trees.slice(1));
    }

    const result: XmlTree[] = [];
    for (const tree of trees) {
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

export function extractAllText(tree: XmlTree): string {
    switch (tree.type) {
        case 'text':
            return tree.text.trim();
        case 'document':
        case 'element':
            return tree.children
                .map(extractAllText)
                .join('\n');
        case 'comment':
        case 'cdata':
            return '';
        default:
            assertNever(tree);
            return '';
    }
}
