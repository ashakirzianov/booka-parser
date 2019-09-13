import {
    BookContentNode, ChapterNode, VolumeNode, VolumeMeta,
} from 'booka-common';
import {
    AsyncStreamParser, yieldLast, ParserDiagnostic,
    compoundDiagnostic, ResultLast, SuccessLast, reject,
} from '../combinators';
import { BookElement, TitleOrContentElement } from './bookElement';

type ImageResolver = (ref: string) => Promise<Buffer | undefined>;
export type ElementParserEnv = {
    resolveImageRef: ImageResolver,
};
export type ElementParser = AsyncStreamParser<BookElement, VolumeNode, ElementParserEnv>;

export const elementParser: ElementParser = async ({ stream, env }) => {
    const diags: ParserDiagnostic[] = [];
    const result = await parseMeta({
        elements: stream,
        resolveImage: env.resolveImageRef,
    });
    diags.push(result.diagnostic);
    const nodes = await buildChapters(result.value.titleOrContent, env);
    diags.push(nodes.diagnostic);

    const volume: VolumeNode = {
        node: 'volume',
        nodes: nodes.value,
        meta: result.value.meta,
    };

    return yieldLast(volume, compoundDiagnostic(diags));
};

async function parseMeta(input: { elements: BookElement[], resolveImage: ImageResolver }) {
    const meta: VolumeMeta = {};
    const titleOrContent: TitleOrContentElement[] = [];
    const diags: ParserDiagnostic[] = [];
    for (const el of input.elements) {
        switch (el.element) {
            case 'tag':
                const tag = el.tag;
                switch (tag.tag) {
                    case 'title':
                        meta.title = tag.value;
                        break;
                    case 'author':
                        meta.author = tag.value;
                        break;
                    case 'cover-ref':
                        const coverImageBuffer = await input.resolveImage(tag.value);
                        if (coverImageBuffer) {
                            meta.coverImageNode = {
                                node: 'image-data',
                                id: tag.value,
                                data: coverImageBuffer,
                            };
                        } else {
                            diags.push({ diag: 'couldnt-resolve-cover', id: tag.value });
                        }
                        break;
                }
                break;
            case 'chapter-title':
            case 'content':
                titleOrContent.push(el);
                break;
            default:
                break;
        }
    }

    if (meta.title === undefined) {
        diags.push({ diag: 'empty-book-title' });
    }

    return yieldLast({
        meta, titleOrContent,
    }, compoundDiagnostic(diags));
}

async function buildChapters(elements: BookElement[], env: ElementParserEnv): Promise<SuccessLast<BookContentNode[]>> {
    const { nodes, next, diag } = await buildChaptersImpl(elements, undefined, env);

    const tailDiag = next.length !== 0
        ? { diag: 'extra-nodes-tail', nodes: elements }
        : undefined;

    return yieldLast(nodes, compoundDiagnostic([diag, tailDiag]));
}

type BuildChaptersResult = {
    nodes: BookContentNode[],
    next: BookElement[],
    diag: ParserDiagnostic,
};
async function buildChaptersImpl(elements: BookElement[], level: number | undefined, env: ElementParserEnv): Promise<BuildChaptersResult> {
    if (elements.length === 0) {
        return { nodes: [], next: [], diag: undefined };
    }
    const headNode = elements[0];
    if (headNode.element === 'chapter-title') {
        if (level === undefined || level > headNode.level) {
            const content = await buildChaptersImpl(elements.slice(1), headNode.level, env);
            const chapter: ChapterNode = {
                node: 'chapter',
                nodes: content.nodes,
                title: headNode.title,
                level: headNode.level,
            };
            const after = await buildChaptersImpl(content.next, level, env);
            return {
                nodes: [chapter as BookContentNode].concat(after.nodes),
                next: after.next,
                diag: after.diag,
            };
        } else {
            return {
                nodes: [],
                next: elements,
                diag: undefined,
            };
        }
    } else {
        const node = await resolveRawNode(headNode, env);
        const after = await buildChaptersImpl(elements.slice(1), level, env);
        return {
            nodes: node.success
                ? [node.value, ...after.nodes]
                : after.nodes,
            next: after.next,
            diag: compoundDiagnostic([after.diag, node.diagnostic]),
        };
    }
}

// TODO: propagate diags
async function resolveRawNode(rawNode: BookElement, env: ElementParserEnv): Promise<ResultLast<BookContentNode>> {
    switch (rawNode.element) {
        case 'image-ref':
            const imageBuffer = await env.resolveImageRef(rawNode.imageId);
            if (imageBuffer) {
                return yieldLast({
                    node: 'image-data',
                    id: rawNode.imageId,
                    data: imageBuffer,
                });
            } else {
                return reject({ diag: 'couldnt-resolve-ref', id: rawNode.imageId, context: 'image-node' });
            }
        default:
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'node' });
    }
}
