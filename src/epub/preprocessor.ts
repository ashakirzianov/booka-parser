import {
    Book, BookNode,
    processBookImages, justNodeGenerator, normalizeBook,
    mapSpan, Span, extractBookText, flatten,
} from 'booka-common';
import {
    SuccessLast, yieldLast, ParserDiagnostic, compoundDiagnostic,
} from '../combinators';
import { xmlStringParser, extractAllText } from '../xml';
import { EpubBook } from './epubFileParser';
import { collectMetrics, metricsDiff } from './bookMetrics';

type PreprocessorArgs = { book: Book, epub: EpubBook };
type BookPreprocessor = (args: PreprocessorArgs) => Promise<SuccessLast<Book>>;

const preprocessors: BookPreprocessor[] = [
    images,
    references,
    consistency,
    normalize,
];
export async function preprocessor({ book, epub }: PreprocessorArgs): Promise<SuccessLast<Book>> {
    const diags: ParserDiagnostic[] = [];
    const before = collectMetrics(book);
    for (const proc of preprocessors) {
        const result = await proc({ book, epub });
        diags.push(result.diagnostic);
        book = result.value;
    }
    const after = collectMetrics(book);
    const diff = metricsDiff(before, after);
    if (diff !== undefined) {
        diags.push({
            diag: 'metrics changed',
            diff,
        });
    }

    return yieldLast(book, compoundDiagnostic(diags));
}

// Images:

async function images({ book, epub }: PreprocessorArgs) {
    const diags: ParserDiagnostic[] = [];
    const resolvedVolume = await processBookImages(book, async image => {
        if (image.kind === 'ref') {
            const buffer = await epub.imageResolver(image.ref);
            if (buffer) {
                return {
                    ...image,
                    kind: 'buffer',
                    imageId: image.imageId,
                    buffer: buffer,
                };
            } else {
                diags.push({
                    diag: 'couldnt-resolve-image',
                    id: image.imageId,
                });
                return image;
            }
        } else {
            return image;
        }
    });
    const resolved = {
        ...book,
        volume: resolvedVolume,
    };
    return yieldLast(resolved, compoundDiagnostic(diags));
}

// Refs:

async function references({ book, epub }: PreprocessorArgs) {
    const { value: nodes, diagnostic } = checkNodesReferences(book.nodes);
    const resultBook = {
        ...book,
        nodes: nodes,
    };
    return yieldLast(resultBook, diagnostic);
}

function checkNodesReferences(nodes: BookNode[]): SuccessLast<BookNode[]> {
    const diags: ParserDiagnostic[] = [];
    const nodeIds: string[] = [];
    const refs = extractRefsFromNodes(nodes);
    for (const node of justNodeGenerator(nodes)) {
        if (node.refId !== undefined) {
            if (!refs.some(ref => ref === node.refId)) {
                // NOTE: ugly mutation
                node.refId = undefined;
            } else {
                nodeIds.push(node.refId);
            }
        }
    }

    for (const ref of refs) {
        if (!nodeIds.some(id => id === ref)) {
            diags.push({
                diag: 'could not resolve ref',
                ref,
            });
        }
    }

    return yieldLast(nodes);
}

function extractRefsFromNodes(nodes: BookNode[]): string[] {
    const refs: string[] = [];
    for (const node of justNodeGenerator(nodes)) {
        switch (node.node) {
            case 'pph':
                refs.push(...extractRefsFromSpan(node.span));
                break;
        }
    }

    return refs;
}

function extractRefsFromSpan(span: Span): string[] {
    return mapSpan(span, {
        compound: spans => flatten(spans.map(extractRefsFromSpan)),
        ref: (_, ref) => [ref],
        default: () => [],
    });
}

// Consistency:

async function consistency({ book, epub }: PreprocessorArgs) {
    const epubText = await extractEpubText(epub);
    const bookText = extractBookText(book);
    const ratio = bookText.length / epubText.length;
    const diag: ParserDiagnostic = ratio < 0.95
        ? {
            diag: 'low text ratio',
            ratio: Math.floor(ratio * 100),
        }
        : undefined;
    return yieldLast(book, diag);
}

async function extractEpubText(epub: EpubBook): Promise<string> {
    let result = '';
    for await (const section of epub.sections()) {
        result += extractXmlText(section.content);
    }
    return result;
}

function extractXmlText(xmlString: string): string {
    const xml = xmlStringParser({
        xmlString: xmlString,
    });
    return xml.success
        ? extractAllText(xml.value)
        : '';
}

// Normalization:

async function normalize({ book, epub }: PreprocessorArgs) {
    const normalized = normalizeBook(book);

    return yieldLast(normalized);
}
