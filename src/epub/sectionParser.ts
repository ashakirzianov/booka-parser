import { ChapterTitle, RawBookNode } from 'booka-common';
import {
    XmlNode, makeStream, path, children, choice,
} from '../xml';
import { isWhitespaces } from '../utils';
import { ParserDiagnoser } from '../log';
import {
    EpubNodeParserEnv, constrainElement, EpubNodeParser, fullParser, headNode,
} from './nodeParser';
import { EpubSection } from './epubParser.types';

export function parseSections(sections: EpubSection[], hooks: EpubNodeParser[], ds: ParserDiagnoser) {
    const allParsers = hooks.concat(standardParsers);
    const singleParser = choice(...allParsers);
    const sectionParser = buildSectionParser(singleParser);

    const result: RawBookNode[] = [];
    for (const section of sections) {
        const env: EpubNodeParserEnv = {
            ds: ds,
            filePath: section.filePath,
            recursive: singleParser,
        };
        const nodes = section.content.type === 'document'
            ? section.content.children
            : [section.content];
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

function buildSectionParser(parser: EpubNodeParser) {
    const bodyParser = children(fullParser(parser));
    const resultParser = path(['html', 'body'], bodyParser);

    return resultParser;
}

const text = headNode(node => {
    if (node.type !== 'text') {
        return null;
    }
    // Skip whitespace nodes
    if (node.text.startsWith('\n') && isWhitespaces(node.text)) {
        return [];
    } else {
        return [{
            node: 'span',
            span: node.text,
        }];
    }
});

const italic = constrainElement(['em', 'i'], {}, (el, env) => [{
    node: 'attr',
    attributes: ['italic'],
    content: buildContainerNode(el.children, env),
}]);

const bold = constrainElement(['strong', 'b'], {}, (el, env) => [{
    node: 'attr',
    attributes: ['bold'],
    content: buildContainerNode(el.children, env),
}]);

const quote = constrainElement('q', { class: null }, (el, env) => {
    return [{
        node: 'attr',
        attributes: ['quote'],
        content: buildContainerNode(el.children, env),
    }];
});

const a = constrainElement(
    'a',
    {
        class: null, href: null,
        id: null, title: null, tag: null,
    },
    (el, env) => {
        if (el.attributes.href !== undefined) {
            return [{
                node: 'ref',
                to: el.attributes.href,
                content: buildContainerNode(el.children, env),
            }];
        } else if (el.attributes.id !== undefined) {
            return [{
                node: 'container',
                ref: `${env.filePath}#${el.attributes.id}`,
                nodes: [buildContainerNode(el.children, env)],
            }];
        } else {
            return [];
        }
    });

// TODO: re-implement
const pph = constrainElement(
    ['p', 'div', 'span'],
    {
        class: null, id: null,
        'xml:space': null, // TODO: handle ?
    },
    (el, env) => {
        const container = buildContainerNode(el.children, env);
        const result: RawBookNode[] = el.attributes.id
            ? [{
                node: 'container',
                ref: `${env.filePath}#${el.attributes.id}`,
                nodes: [container],
            }]
            : [container];
        return result;
    });

const img = constrainElement(
    'img',
    { src: null, alt: null, class: null },
    (el, env) => {
        const src = el.attributes['src'];
        if (src) {
            return [{
                node: 'image-ref',
                imageId: src,
            }];
        } else {
            env.ds.add({
                diag: 'img-must-have-src',
                node: el,
            });
            return [];
        }
    });

const image = constrainElement('image', {}, (el, env) => {
    const xlinkHref = el.attributes['xlink:href'];
    if (xlinkHref) {
        return [{
            node: 'image-ref',
            imageId: xlinkHref,
        }];
    } else {
        env.ds.add({ diag: 'image-must-have-xlinkhref', node: el });
        return [];
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
        return [{
            node: 'title',
            title: title,
            level: 4 - level,
        }];
    });

const svg = constrainElement(
    'svg',
    { viewBox: null, xmlns: null, class: null },
    () => []
);

const rest = constrainElement(
    ['sup', 'sub', 'ul', 'li', 'br'], // TODO: do not ignore 'br'
    {},
    (el, env) => {
        return [];
    });

const standardParsers = [
    text, italic, bold, quote,
    a, pph, img, image, header,
    svg, rest,
];

function buildContainerNode(nodes: XmlNode[], env: EpubNodeParserEnv): RawBookNode {
    const parser = fullParser(env.recursive);
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
