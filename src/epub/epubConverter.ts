import { ChapterTitle, Book, KnownTag, RawBookNode } from 'booka-common';
import { EpubBook, EpubSection } from './epubParser.types';
import {
    isElement, XmlNodeElement, XmlNode, childForPath, makeStream, path, children,
} from '../xml';
import {
    AsyncIter, isWhitespaces, flatten, equalsToOneOf, filterUndefined,
} from '../utils';
import { buildVolume } from '../buildVolume';
import { EpubConverterParameters, EpubConverter, EpubConverterResult, MetadataHook, MetadataRecord } from './epubConverter.types';
import { ParserDiagnoser, diagnoser } from '../log';
import {
    EpubNodeParserEnv, handleXml, constrainElement,
    combineHandlers, EpubNodeParser, makeHandler, fullParser,
} from './nodeParser';

export function createConverter(params: EpubConverterParameters): EpubConverter {
    return {
        convertEpub: epub => convertEpub(epub, params),
    };
}

async function convertEpub(epub: EpubBook, params: EpubConverterParameters): Promise<EpubConverterResult> {
    const ds = diagnoser({ context: 'epub', kind: epub.kind });
    try {
        if (epub.kind === 'unknown') {
            ds.add({ diag: 'unknown-kind' });
        }

        const hooks = params.options[epub.kind];
        const sections = await AsyncIter.toArray(epub.sections());
        const rawNodes = parseRawNodes(sections, hooks.nodeHooks, ds);
        const tags = buildMetaTags(epub, hooks.metadataHooks, ds);
        const metaNodes = buildMetaNodes(tags);
        const allNodes = rawNodes.concat(metaNodes);

        const volume = await buildVolume(allNodes, {
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

function buildMetaNodes(tags: KnownTag[]): RawBookNode[] {
    const filtered = tags.filter(t => equalsToOneOf(t.tag, ['author', 'title', 'cover-ref']));
    const nodes = filtered.map(t => ({
        node: 'tag',
        tag: t,
    } as const));
    return nodes;
}

function getBodyElement(node: XmlNode): XmlNodeElement | undefined {
    const body = childForPath(node, 'html', 'body');
    return body && isElement(body)
        ? body
        : undefined;
}

function buildSectionParser(parser: EpubNodeParser) {
    const bodyParser = children(fullParser(parser));
    const resultParser = path(['html', 'body'], bodyParser);

    return resultParser;
}

function parseRawNodes(sections: EpubSection[], hooks: EpubNodeParser[], ds: ParserDiagnoser) {
    const handlers = hooks.concat(standardHandlers);
    const singleParser = combineHandlers(handlers);
    const sectionParser = buildSectionParser(singleParser);

    const result: RawBookNode[] = [];
    for (const section of sections) {
        const env: EpubNodeParserEnv = {
            ds: ds,
            filePath: section.filePath,
            nodeParser: singleParser,
        };
        const nodes = section.content.type === 'document'
            ? section.content.children
            : [];
        const stream = makeStream(nodes, env);
        const sectionResult = sectionParser(stream);
        if (sectionResult.success) {
            result.push(...sectionResult.value);
        } else {
            ds.add({ diag: 'couldnt-parse-section', filePath: section.filePath });
        }
    }

    return result;
}

const text = handleXml(node => {
    if (node.type !== 'text') {
        return undefined;
    }
    // Skip whitespace nodes
    if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
        return { node: 'ignore' };
    } else {
        return {
            node: 'span',
            span: node.text,
        };
    }
});

const italic = constrainElement(['em', 'i'], {}, (el, env) => ({
    node: 'attr',
    attributes: ['italic'],
    content: buildContainerNode(el.children, env),
}));

const bold = constrainElement(['strong', 'b'], {}, (el, env) => ({
    node: 'attr',
    attributes: ['bold'],
    content: buildContainerNode(el.children, env),
}));

const quote = constrainElement('q', { class: null }, (el, env) => {
    return {
        node: 'attr',
        attributes: ['quote'],
        content: buildContainerNode(el.children, env),
    };
});

const a = constrainElement(
    'a',
    {
        class: null, href: null,
        id: null, title: null, tag: null,
    },
    (el, env) => {
        if (el.attributes.href !== undefined) {
            return {
                node: 'ref',
                to: el.attributes.href,
                content: buildContainerNode(el.children, env),
            };
        } else if (el.attributes.id !== undefined) {
            return {
                node: 'container',
                ref: `${env.filePath}#${el.attributes.id}`,
                nodes: [buildContainerNode(el.children, env)],
            };
        } else {
            return { node: 'ignore' };
        }
    });

const pph = constrainElement(
    ['p', 'div', 'span'],
    {
        class: null, id: null,
        'xml:space': null, // TODO: handle ?
    },
    (el, env) => {
        const container = buildContainerNode(el.children, env);
        const result: RawBookNode = el.attributes.id
            ? {
                node: 'container',
                ref: `${env.filePath}#${el.attributes.id}`,
                nodes: [container],
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
                node: 'image-ref',
                imageId: src,
            };
        } else {
            env.ds.add({
                diag: 'img-must-have-src',
                node: el,
            });
            return { node: 'ignore' };
        }
    });

const image = constrainElement('image', {}, (el, env) => {
    const xlinkHref = el.attributes['xlink:href'];
    if (xlinkHref) {
        return {
            node: 'image-ref',
            imageId: xlinkHref,
        };
    } else {
        env.ds.add({ diag: 'image-must-have-xlinkhref', node: el });
        return { node: 'ignore' };
    }
});

const header = constrainElement(
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    { id: null },
    (el, env) => {
        const level = parseInt(el.name[1], 10);
        const title = extractTitle(el.children, env.ds);
        if (title.length === 0) {
            env.ds.add({ diag: 'no-title', node: el });
        }
        return {
            node: 'title',
            title: title,
            level: 4 - level,
        };
    });

const svg = constrainElement(
    'svg',
    { viewBox: null, xmlns: null, class: null },
    () => ({ node: 'ignore' })
);

const rest = constrainElement(
    ['sup', 'sub', 'ul', 'li', 'br'], // TODO: do not ignore 'br'
    {},
    (el, env) => {
        return { node: 'ignore' };
    });

const standardHandlers = [
    text, italic, bold, quote,
    a, pph, img, image, header,
    svg, rest,
];

function buildContainerNode(nodes: XmlNode[], env: EpubNodeParserEnv): RawBookNode {
    const parser = fullParser(env.nodeParser);
    const stream = makeStream(nodes, env);
    const result = parser(stream);

    return {
        node: 'container',
        nodes: result.value,
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
                    case 'em': case 'strong': case 'big':
                    case 'a': case 'b':
                    case 'span': case 'div': case 'p':
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

    return lines;
}

function defaultMetadataHook({ key, value }: MetadataRecord): KnownTag[] | undefined {
    switch (key) {
        case 'title':
            return [{ tag: 'title', value }];
        case 'creator':
            return [{ tag: 'author', value }];
        case 'cover':
            return [{ tag: 'cover-ref', value }];
        case 'subject':
            return [{ tag: 'subject', value }];
        case 'language':
            return [{ tag: 'language', value }];
        case 'publisher':
            return [{ tag: 'publisher', value }];
        case 'description':
            return [{ tag: 'description', value }];
        case 'series':
            return [{ tag: 'series', value }];
        case 'ISBN':
            return [{ tag: 'ISBN', value }];
        case 'dc:rights':
            return [{ tag: 'rights', value }];
        case 'creatorFileAs':
        case 'date':
        case 'dc:identifier':
            return [];
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
