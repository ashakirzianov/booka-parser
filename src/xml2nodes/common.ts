import {
    Diagnostic, Success, success,
    compoundDiagnostic, Semantic, Image,
} from 'booka-common';
import { Xml, xml2string, XmlElement } from '../xml';
import { isWhitespaces } from '../utils';

export type AttributesHookResult = {
    flag?: Semantic,
    diag?: Diagnostic,
};
export type AttributesHook = (element: string, attr: string, value: string) => AttributesHookResult;
export type XmlHooks = {
    attributesHook?: AttributesHook,
};
export type Xml2NodesEnv = {
    hooks?: XmlHooks,
    filePath: string,
};

export function buildRefId(filePath: string, id: string) {
    return `${filePath}#${id}`;
}

export function expectEmptyContent(children: Xml[]): Diagnostic {
    return children.length > 0
        ? {
            diag: 'unexpected children',
            xmls: children.map(xml2string),
        }
        : undefined;
}

export function unexpectedNode(node: Xml, context?: any): Diagnostic {
    return {
        diag: 'unexpected node',
        xml: xml2string(node),
        ...(context !== undefined && { context }),
    };
}

export function imgData(node: XmlElement, env: Xml2NodesEnv): Success<Image | undefined> {
    const src = node.attributes.src;
    if (src !== undefined) {
        if (!src.endsWith('.png') && !src.endsWith('.jpg') && !src.endsWith('jpeg')) {
            return success(undefined, {
                diag: 'unsupported image format',
                severity: 'info',
                src,
            });
        } else if (src.match(/^www\.[^\.]+\.com/)) {
            return success(undefined, {
                diag: 'external src',
                severity: 'info',
                src,
            });
        }
        return success(
            {
                image: 'ref',
                imageId: src,
                title: node.attributes.title || node.attributes.alt,
            },
            expectEmptyContent(node.children),
        );
    } else {
        return success(undefined, compoundDiagnostic([
            {
                diag: 'img: src not set',
                severity: 'info',
                xml: xml2string(node),
            },
            expectEmptyContent(node.children),
        ]));
    }
}

export function isTrailingWhitespace(node: Xml): boolean {
    return node.type === 'text' && isWhitespaces(node.text);
}
