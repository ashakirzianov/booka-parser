import {
    BookContentNode, ChapterNode, VolumeNode, VolumeMeta,
    tagValue,
} from 'booka-common';
import { filterUndefined } from '../utils';
import { spanFromRawNode } from './common';
import { flattenElements } from './flattenElements';
import {
    AsyncStreamParser, yieldLast, ParserDiagnostic,
    compoundDiagnostic, ResultLast, SuccessLast, reject,
} from '../combinators';
import { BookElement, TagElement } from './bookElement';

export type ElementParserEnv = {
    resolveImageRef: (ref: string) => Promise<Buffer | undefined>,
};
export type ElementParser = AsyncStreamParser<BookElement, VolumeNode, ElementParserEnv>;

export const elementParser: ElementParser = async ({ stream, env }) => {
    const diags: ParserDiagnostic[] = [];
    const meta = await collectMeta(stream, env);
    const preprocessed = flattenElements(stream);
    const nodes = await buildChapters(preprocessed, env);
    diags.push(nodes.diagnostic);

    if (meta.title === undefined) {
        diags.push({ diag: 'empty-book-title' });
    }

    const volume: VolumeNode = {
        node: 'volume',
        nodes: nodes.value,
        meta: meta,
    };

    return yieldLast(volume, compoundDiagnostic(diags));
};

async function collectMeta(elements: BookElement[], env: ElementParserEnv): Promise<VolumeMeta> {
    const tags = elements
        .filter((n): n is TagElement => n.element === 'tag')
        .map(n => n.tag);

    const coverRef = tagValue(tags, 'cover-ref') || undefined;
    const coverImageBuffer = coverRef ? await env.resolveImageRef(coverRef) : undefined;
    const coverImageNode = coverRef && coverImageBuffer ? {
        node: 'image-data' as const,
        id: coverRef,
        data: coverImageBuffer,
    } : undefined;

    return {
        title: tagValue(tags, 'title') || undefined,
        author: tagValue(tags, 'author') || undefined,
        coverImageNode: coverImageNode,
    };
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
        case 'compound':
            // TODO: propagate diags
            const rs = rawNode.elements
                .map(c => spanFromRawNode(c));
            const spans = filterUndefined(
                rs
                    .map(r => r.success ? r.value : undefined)
            );
            const ds = rs.map(r => r.diagnostic);
            return yieldLast({
                node: 'paragraph',
                span: {
                    span: 'compound',
                    spans: spans,
                },
            }, compoundDiagnostic(ds));
        default:
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'node' });
    }
}
