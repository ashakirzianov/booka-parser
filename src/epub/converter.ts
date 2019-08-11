import { EpubBook, EpubSection } from './epubParser';
import { VolumeNode, ChapterTitle } from '../common/bookFormat';
import {
    isElement, XmlNodeElement, XmlNode,
    isTextNode, childForPath,
} from '../xml';
import {
    AsyncIter, isWhitespaces, flatten,
} from '../utils';
import { Block, ContainerBlock, blocks2book } from '../bookBlocks';
import { EpubConverterParameters, EpubConverter, EpubConverterOptions, applyHooks, EpubConverterHookEnv } from './epubConverter';
import { WithDiagnostics, ParserDiagnoser, diagnoser } from '../log';

export function createConverter(params: EpubConverterParameters): EpubConverter {
    return {
        convertEpub: epub => convertEpub(epub, params),
    };
}

async function convertEpub(epub: EpubBook, params: EpubConverterParameters): Promise<WithDiagnostics<VolumeNode>> {
    const ds = diagnoser({ context: 'epub', title: epub.metadata.title });
    if (epub.source === 'unknown') {
        ds.add({ diag: 'unknown-source' });
    }

    const hooks = params.options[epub.source];
    const sections = await AsyncIter.toArray(epub.sections());
    const blocks = flatten(sections.map(s =>
        section2blocks(s, { ds, hooks })));
    const metaBlocks = buildMetaBlocks(epub);
    const allBlocks = blocks.concat(metaBlocks);

    const book = blocks2book(allBlocks, ds);

    return {
        value: book,
        diagnostics: ds,
    };
}

function buildMetaBlocks(epub: EpubBook): Block[] {
    const result: Block[] = [];
    if (epub.metadata.title) {
        result.push({
            block: 'book-title',
            title: epub.metadata.title,
        });
    }

    if (epub.metadata.author) {
        result.push({
            block: 'book-author',
            author: epub.metadata.author,
        });
    }

    return result;
}

function getBodyElement(node: XmlNode): XmlNodeElement | undefined {
    const body = childForPath(node, 'html', 'body');
    return body && isElement(body)
        ? body
        : undefined;
}

type Env = {
    ds: ParserDiagnoser,
    hooks: EpubConverterOptions,
};

function section2blocks(section: EpubSection, env: Env): Block[] {
    const body = getBodyElement(section.content);
    if (!body) {
        return [];
    }

    return flatten(body.children.map(node =>
        buildBlock(node, section.fileName, env)));
}

function buildBlock(node: XmlNode, filePath: string, env: Env): Block[] {
    const hookEnv: EpubConverterHookEnv = {
        ds: env.ds,
        node2blocks: n =>
            buildBlock(n, filePath, env),
        filePath,
    };
    const hooked = applyHooks(node, env.hooks.nodeHooks, hookEnv);
    if (hooked) {
        return hooked;
    }

    if (shouldSkipNode(node)) {
        return [];
    }

    switch (node.type) {
        case 'text':
            return [{
                block: 'text',
                text: node.text,
            }];
        case 'element':
            switch (node.name) {
                case 'em':
                    diagnoseUnexpectedAttributes(node, env.ds);
                    return [{
                        block: 'attrs',
                        attr: 'italic',
                        content: buildContainerBlock(node.children, filePath, env),
                    }];
                case 'strong':
                    diagnoseUnexpectedAttributes(node, env.ds);
                    return [{
                        block: 'attrs',
                        attr: 'bold',
                        content: buildContainerBlock(node.children, filePath, env),
                    }];
                case 'a':
                    diagnoseUnexpectedAttributes(node, env.ds, [
                        'href',
                        'class', 'id',
                        'title',
                    ]);
                    if (node.attributes.href !== undefined) {
                        return [{
                            block: 'footnote-ref',
                            id: node.attributes.href,
                            content: buildContainerBlock(node.children, filePath, env),
                        }];
                    } else {
                        env.ds.add({ diag: 'link-must-have-ref', node });
                        return [];
                    }
                case 'p':
                case 'span':
                case 'div':
                    diagnoseUnexpectedAttributes(node, env.ds, ['class', 'id']);
                    const container = buildContainerBlock(node.children, filePath, env);
                    const result: Block = node.attributes.id
                        ? {
                            block: 'footnote-candidate',
                            id: `${filePath}#${node.attributes.id}`,
                            title: [],
                            content: container,
                        } : container;
                    return [result];
                case 'img':
                case 'image':
                case 'svg':
                    // TODO: support images
                    diagnoseUnexpectedAttributes(node, env.ds, [
                        'src', 'class', 'alt',
                        'height', 'width', 'viewBox',
                        'xmlns', 'xlink:href', 'xmlns:xlink',
                    ]);
                    return [];
                case 'h1': case 'h2': case 'h3':
                case 'h4': case 'h5': case 'h6':
                    diagnoseUnexpectedAttributes(node, env.ds, ['class']);
                    const level = parseInt(node.name[1], 10);
                    const title = extractTitle(node.children, env.ds);
                    return [{
                        block: 'chapter-title',
                        title: title,
                        level: 4 - level,
                    }];
                case 'sup': case 'sub':
                    // TODO: implement superscript & subscript parsing
                    diagnoseUnexpectedAttributes(node, env.ds);
                    return [];
                case 'ul': case 'li':
                    diagnoseUnexpectedAttributes(node, env.ds);
                    // TODO: handle lists
                    return [];
                case 'br':
                    diagnoseUnexpectedAttributes(node, env.ds);
                    return [];
                default:
                    env.ds.add({ diag: 'unexpected-node', node });
                    return [];
            }
        default:
            env.ds.add({ diag: 'unexpected-node', node });
            return [];
    }
}

function buildContainerBlock(nodes: XmlNode[], filePath: string, env: Env): ContainerBlock {
    const content = flatten(nodes
        .map(ch => buildBlock(ch, filePath, env)));

    return {
        block: 'container',
        content,
    };
}

function extractTitle(nodes: XmlNode[], ds: ParserDiagnoser): ChapterTitle {
    const lines: string[] = [];
    for (const node of nodes) {
        switch (node.type) {
            case 'text':
                if (!isWhitespaces(node.text)) {
                    lines.push(node.text);
                }
                break;
            case 'element':
                switch (node.name) {
                    case 'em': case 'strong':
                        const fromElement = extractTitle(node.children, ds);
                        lines.push(fromElement.join(''));
                        break;
                    default:
                        ds.add({ diag: 'unexpected-node', node, context: 'title' });
                        break;
                }
                break;
            default:
                ds.add({ diag: 'unexpected-node', node, context: 'title' });
                break;
        }
    }

    if (lines.length === 0) {
        ds.add({ diag: 'no-title', nodes });
    }
    return lines;
}

function diagnoseUnexpectedAttributes(element: XmlNodeElement, ds: ParserDiagnoser, expected: string[] = []) {
    for (const [attr, value] of Object.entries(element.attributes)) {
        if (!expected.some(e => e === attr)) {
            ds.add({ diag: 'unexpected-attr', name: attr, value, element });
        }
    }
}

function shouldSkipNode(node: XmlNode): boolean {
    if (isTextNode(node)) {
        if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
            return true;
        }
    }
    return false;
}
