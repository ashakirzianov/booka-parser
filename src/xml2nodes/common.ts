import {
    Diagnostic, Success, success,
    compoundDiagnostic, NodeFlag, Image,
} from 'booka-common';
import { Xml, xml2string, XmlElement } from '../xml';
import { isWhitespaces } from '../utils';
import { extname } from 'path';

export type AttributesHookResult = {
    flag?: NodeFlag,
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
        if (src.match(/^www\.[^\.]+\.com/)) {
            return success(undefined, {
                diag: 'external src',
                severity: 'info',
                src,
            });
        }
        const ext = extname(src).toLowerCase();
        switch (ext) {
            case '.png':
            case '.jpg':
            case '.jpeg':
            case '.gif':
                {
                    const title = node.attributes.title || node.attributes.alt;
                    const height = node.attributes.height
                        ? parseInt(node.attributes.height, 10) ?? undefined
                        : undefined;
                    const width = node.attributes.width
                        ? parseInt(node.attributes.width, 10) ?? undefined
                        : undefined;
                    return success(
                        {
                            image: 'ref',
                            imageId: src,
                            title,
                            height, width,
                        },
                        expectEmptyContent(node.children),
                    );
                }
            default:
                return success(undefined, {
                    diag: 'unsupported image format',
                    severity: 'info',
                    src,
                });
        }
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
