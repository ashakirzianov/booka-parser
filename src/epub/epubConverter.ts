import { ChapterTitle, Book, KnownTag, tagValue } from 'booka-common';
import { EpubBook, EpubSection } from './epubParser.types';
import {
    isElement, XmlNodeElement, XmlNode, childForPath,
} from '../xml';
import {
    AsyncIter, isWhitespaces, flatten,
} from '../utils';
import { Block, ContainerBlock, blocks2book } from '../bookBlocks';
import { EpubConverterParameters, EpubConverter, EpubConverterResult, MetadataHook, MetadataRecord } from './epubConverter.types';
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

async function convertEpub(epub: EpubBook, params: EpubConverterParameters): Promise<EpubConverterResult> {
    const ds = diagnoser({ context: 'epub' });
    try {
        if (epub.kind === 'unknown') {
            ds.add({ diag: 'unknown-kind' });
        }

        const hooks = params.options[epub.kind];
        const sections = await AsyncIter.toArray(epub.sections());
        const blocks = sections2blocks(sections, hooks.nodeHooks, ds);
        const tags = buildMetaTags(epub, hooks.metadataHooks, ds);
        const metaBlocks = buildMetaBlocks(tags);
        const allBlocks = blocks.concat(metaBlocks);

        const volume = await blocks2book(allBlocks, {
            ds,
            resolveImageRef: epub.imageResolver,
        });
        const book: Book = {
            volume,
            source: {
                source: 'epub',
                kind: epub.kind,
            },
            tags: tags,
        };

        return {
            success: true,
            book: book,
            kind: epub.kind,
            diagnostics: ds.all(),
        };
    } catch {
        return {
            success: false,
            diagnostics: ds.all(),
        };
    }
}

function buildMetaBlocks(tags: KnownTag[]): Block[] {
    const result: Block[] = [];

    const titleTag = tagValue(tags, 'title');
    if (titleTag) {
        result.push({
            block: 'book-title',
            title: titleTag,
        });
    }

    const authorTag = tagValue(tags, 'author');
    if (authorTag) {
        result.push({
            block: 'book-author',
            author: authorTag,
        });
    }

    const coverRefTag = tagValue(tags, 'cover-ref');
    if (coverRefTag) {
        result.push({
            block: 'cover',
            reference: coverRefTag,
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

const italic = constrainElement(['em', 'i'], {}, (el, env) => ({
    block: 'attrs',
    attr: 'italic',
    content: buildContainerBlock(el.children, env),
}));

const strong = constrainElement('strong', {}, (el, env) => ({
    block: 'attrs',
    attr: 'bold',
    content: buildContainerBlock(el.children, env),
}));

const a = constrainElement(
    'a',
    { class: null, href: null, id: null },
    (el, env) => {
        if (el.attributes.href !== undefined) {
            return {
                block: 'footnote-ref',
                id: el.attributes.href,
                content: buildContainerBlock(el.children, env),
            };
        } else if (el.attributes.id !== undefined) {
            return {
                block: 'footnote-candidate',
                title: [],
                id: el.attributes.id,
                content: buildContainerBlock(el.children, env),
            };
        } else {
            env.ds.add({ diag: 'link-must-have-ref', node: el });
            return { block: 'ignore' };
        }
    });

const pph = constrainElement(
    ['p', 'div', 'span'],
    {
        class: null, id: null,
        'xml:space': null, // TODO: handle ?
    },
    (el, env) => {
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

const img = constrainElement(
    'img',
    { src: null, alt: null, class: null },
    (el, env) => {
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

const image = constrainElement('image', {}, (el, env) => {
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

const header = constrainElement(
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    { id: null },
    (el, env) => {
        const level = parseInt(el.name[1], 10);
        const title = extractTitle(el.children, env.ds);
        return {
            block: 'chapter-title',
            title: title,
            level: 4 - level,
        };
    });

const svg = constrainElement(
    'svg',
    { viewBox: null, xmlns: null, class: null },
    () => ({ block: 'ignore' })
);

const rest = constrainElement(
    ['sup', 'sub', 'ul', 'li'],
    {},
    (el, env) => {
        return { block: 'ignore' };
    });

const standardHandlers = [
    text, italic, strong, a, pph, img, image, header,
    svg, rest,
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
                    case 'br':
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

function defaultMetadataHook(meta: MetadataRecord): KnownTag[] | undefined {
    switch (meta.key) {
        case 'title':
            return [{ tag: 'title', value: meta.value }];
        case 'creator':
            return [{ tag: 'author', value: meta.value }];
        case 'cover':
            return [{ tag: 'cover-ref', value: meta.value }];
        case 'subject':
            return [{ tag: 'subject', value: meta.value }];
        case 'language':
            return [{ tag: 'language', value: meta.value }];
        default:
            return undefined;
    }
}

function buildMetaTags(epub: EpubBook, metadataHooks: MetadataHook[], ds: ParserDiagnoser): KnownTag[] {
    const allHooks = metadataHooks.concat(defaultMetadataHook);
    const result: KnownTag[] = [];
    for (const [key, value] of Object.entries(epub.metadata)) {
        if (Array.isArray(value)) {
            const tags = flatten(
                value.map(v => buildMetaTagsForRecord(key, v, allHooks, ds))
            );
            result.push(...tags);
        } else if (value) {
            const tags = buildMetaTagsForRecord(key, value, allHooks, ds);
            result.push(...tags);
        } else {
            ds.add({ diag: 'unknown-meta', key, value });
        }
    }

    return result;
}

function buildMetaTagsForRecord(key: string, value: string, allHooks: MetadataHook[], ds: ParserDiagnoser): KnownTag[] {
    const result: KnownTag[] = [];
    const record = { key, value };
    const tags = allHooks.reduce<KnownTag[] | undefined>(
        (res, hook) => res || hook(record, ds),
        undefined,
    );
    if (!tags) {
        ds.add({ diag: 'unknown-meta', key, value });
        return [];
    } else {
        return tags;
    }
}
