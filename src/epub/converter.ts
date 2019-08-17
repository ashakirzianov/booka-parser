import { EpubBook, EpubSection } from './epubParser';
import { ChapterTitle } from '../bookFormat';
import {
    isElement, XmlNodeElement, XmlNode, childForPath,
} from '../xml';
import {
    AsyncIter, isWhitespaces, flatten,
} from '../utils';
import { Block, ContainerBlock, blocks2book } from '../bookBlocks';
import { EpubConverterParameters, EpubConverter } from './epubConverter';
import { ParserDiagnoser, diagnoser } from '../log';
import {
    NodeHandlerEnv, handleNode, constrainElement,
    NodeHandler, combineHandlers, expectToHandle,
} from './nodeHandler';

export function createConverter(params: EpubConverterParameters): EpubConverter {
    return {
        convertEpub: epub => convertEpub(epub, params),
    };
}

async function convertEpub(epub: EpubBook, params: EpubConverterParameters) {
    const ds = diagnoser({ context: 'epub', title: epub.metadata.title });
    if (epub.source === 'unknown') {
        ds.add({ diag: 'unknown-source' });
    }

    const hooks = params.options[epub.source];
    const sections = await AsyncIter.toArray(epub.sections());
    const blocks = sections2blocks(sections, hooks.nodeHooks, ds);
    const metaBlocks = buildMetaBlocks(epub);
    const allBlocks = blocks.concat(metaBlocks);

    const book = blocks2book(allBlocks, ds);

    return {
        volume: book,
        resolveImage: epub.imageResolver,
        diagnostics: ds.all(),
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

    if (epub.metadata.cover) {
        result.push({
            block: 'cover',
            reference: epub.metadata.cover,
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

function sections2blocks(sections: EpubSection[], hooks: NodeHandler[], ds: ParserDiagnoser) {
    const handlers = hooks.concat(standardHandlers);
    const handler = expectToHandle(combineHandlers(handlers));

    const env: NodeHandlerEnv = {
        ds: ds,
        filePath: null as any,
        node2blocks: null as any,
    };
    env.node2blocks = n => handler(n, env);

    const result: Block[] = [];
    for (const section of sections) {
        const body = getBodyElement(section.content);
        if (!body) {
            continue;
        }

        env.filePath = section.filePath;
        const blockArrays = body
            .children
            .map(env.node2blocks);
        result.push(...flatten(blockArrays));
    }

    return result;
}

const text = handleNode(node => {
    if (node.type !== 'text') {
        return undefined;
    }
    // Skip whitespace nodes
    if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
        return { block: 'ignore' };
    } else {
        return {
            block: 'text',
            text: node.text,
        };
    }
});

const em = constrainElement('em', (el, env) => ({
    block: 'attrs',
    attr: 'italic',
    content: buildContainerBlock(el.children, env),
}));

const strong = constrainElement('strong', (el, env) => ({
    block: 'attrs',
    attr: 'bold',
    content: buildContainerBlock(el.children, env),
}));

const a = constrainElement('a', (el, env) => {
    if (el.attributes.href !== undefined) {
        return {
            block: 'footnote-ref',
            id: el.attributes.href,
            content: buildContainerBlock(el.children, env),
        };
    } else {
        env.ds.add({ diag: 'link-must-have-ref', node: el });
        return { block: 'ignore' };
    }
});

const pph = constrainElement(['p', 'div', 'span'], (el, env) => {
    const container = buildContainerBlock(el.children, env);
    const result: Block = el.attributes.id
        ? {
            block: 'footnote-candidate',
            id: `${env.filePath}#${el.attributes.id}`,
            title: [],
            content: container,
        }
        : container;
    return result;
});

const img = constrainElement('img', (el, env) => {
    const src = el.attributes['src'];
    if (src) {
        return {
            block: 'image',
            reference: src,
        };
    } else {
        env.ds.add({
            diag: 'img-must-have-src',
            node: el,
        });
        return { block: 'ignore' };
    }
});

const image = constrainElement('image', (el, env) => {
    const xlinkHref = el.attributes['xlink:href'];
    if (xlinkHref) {
        return {
            block: 'image',
            reference: xlinkHref,
        };
    } else {
        env.ds.add({ diag: 'image-must-have-xlinkhref', node: el });
        return { block: 'ignore' };
    }
});

const header = constrainElement(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], (el, env) => {
    const level = parseInt(el.name[1], 10);
    const title = extractTitle(el.children, env.ds);
    return {
        block: 'chapter-title',
        title: title,
        level: 4 - level,
    };
});

const rest = constrainElement(['svg', 'sup', 'sub', 'ul', 'li', 'br'], (el, env) => {
    return { block: 'ignore' };
});

const standardHandlers = [
    text, em, strong, a, pph, img, image, header, rest,
];

function buildContainerBlock(nodes: XmlNode[], env: NodeHandlerEnv): ContainerBlock {
    const content = flatten(nodes
        .map(ch => env.node2blocks(ch)));

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
