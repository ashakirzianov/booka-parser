import {
    BookContentNode, ChapterNode, VolumeNode, VolumeMeta,
    tagValue,
} from 'booka-common';
import { filterUndefined } from '../utils';
import { spanFromRawNode } from './common';
import { flattenElements } from './flattenElements';
import {
    AsyncStreamParser, yieldLast, ParserDiagnostic,
    compoundDiagnostic, ResultLast, SuccessLast,
} from '../combinators';
import { BookElement, TagElement } from './bookElement';

export type RawNodesParserEnv = {
    resolveImageRef: (ref: string) => Promise<Buffer | undefined>,
};
export type RawNodesParser = AsyncStreamParser<BookElement, VolumeNode, RawNodesParserEnv>;

export const rawNodesParser: RawNodesParser = async ({ stream, env }) => {
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

async function collectMeta(rawNodes: BookElement[], env: RawNodesParserEnv): Promise<VolumeMeta> {
    const tags = rawNodes
        .filter((n): n is TagElement => n.node === 'tag')
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

async function buildChapters(rawNodes: BookElement[], env: RawNodesParserEnv): Promise<SuccessLast<BookContentNode[]>> {
    const { nodes, next, diag } = await buildChaptersImpl(rawNodes, undefined, env);

    const tailDiag = next.length !== 0
        ? { diag: 'extra-nodes-tail', nodes: rawNodes }
        : undefined;

    return yieldLast(nodes, compoundDiagnostic([diag, tailDiag]));
}

type BuildChaptersResult = {
    nodes: BookContentNode[],
    next: BookElement[],
    diag: ParserDiagnostic,
};
async function buildChaptersImpl(rawNodes: BookElement[], level: number | undefined, env: RawNodesParserEnv): Promise<BuildChaptersResult> {
    if (rawNodes.length === 0) {
        return { nodes: [], next: [], diag: undefined };
    }
    const headNode = rawNodes[0];
    if (headNode.node === 'chapter-title') {
        if (level === undefined || level > headNode.level) {
            const content = await buildChaptersImpl(rawNodes.slice(1), headNode.level, env);
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
                next: rawNodes,
                diag: undefined,
            };
        }
    } else {
        const node = await resolveRawNode(headNode, env);
        const after = await buildChaptersImpl(rawNodes.slice(1), level, env);
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
async function resolveRawNode(rawNode: BookElement, env: RawNodesParserEnv): Promise<ResultLast<BookContentNode>> {
    switch (rawNode.node) {
        case 'image-ref':
            const imageBuffer = await env.resolveImageRef(rawNode.imageId);
            if (imageBuffer) {
                return yieldLast({
                    node: 'image-data',
                    id: rawNode.imageId,
                    data: imageBuffer,
                });
            } else {
                return fail({ custom: 'couldnt-resolve-ref', id: rawNode.imageId, context: 'image-node' });
            }
        case 'span':
            const span = spanFromRawNode(rawNode);
            if (span.success) {
                return yieldLast({
                    node: 'paragraph',
                    span: span.value,
                });
            } else {
                return span;
            }
        case 'compound-raw':
            // TODO: propagate diags
            const rs = rawNode.nodes
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
            return fail({ custom: 'unexpected-raw-node', node: rawNode, context: 'node' });
    }
}