import {
    BookContentNode, ChapterNode, VolumeNode, VolumeMeta,
    RawBookNode, TagNode, tagValue,
} from 'booka-common';
import { filterUndefined } from '../utils';
import { spanFromRawNode } from './common';
import { resolveReferences } from './resolveReferences';
import { flattenNodes } from './flattenNodes';
import {
    AsyncStreamParser, success, ParserDiagnostic,
    compoundDiagnostic, ResultLast, SuccessLast,
} from '../combinators';

export type RawNodesParserEnv = {
    resolveImageRef: (ref: string) => Promise<Buffer | undefined>,
};
export type RawNodesParser = AsyncStreamParser<RawBookNode, VolumeNode, RawNodesParserEnv>;

export const rawNodesParser: RawNodesParser = async ({ stream, env }) => {
    const diags: ParserDiagnostic[] = [];
    const meta = await collectMeta(stream, env);
    const resolved = resolveReferences(stream);
    diags.push(resolved.diagnostic);
    const preprocessed = flattenNodes(resolved.value);
    const nodes = await buildChapters(preprocessed, env);
    diags.push(nodes.diagnostic);

    if (meta.title === undefined) {
        diags.push({ custom: 'empty-book-title' });
    }

    const volume: VolumeNode = {
        node: 'volume',
        nodes: nodes.value,
        meta: meta,
    };

    return success(volume, undefined, compoundDiagnostic(diags));
};

async function collectMeta(rawNodes: RawBookNode[], env: RawNodesParserEnv): Promise<VolumeMeta> {
    const tags = rawNodes
        .filter((n): n is TagNode => n.node === 'tag')
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

async function buildChapters(rawNodes: RawBookNode[], env: RawNodesParserEnv): Promise<SuccessLast<BookContentNode[]>> {
    const { nodes, next, diag } = await buildChaptersImpl(rawNodes, undefined, env);

    const tailDiag = next.length !== 0
        ? { custom: 'extra-nodes-tail', nodes: rawNodes }
        : undefined;

    return success(nodes, undefined, compoundDiagnostic([diag, tailDiag]));
}

type BuildChaptersResult = {
    nodes: BookContentNode[],
    next: RawBookNode[],
    diag: ParserDiagnostic,
};
async function buildChaptersImpl(rawNodes: RawBookNode[], level: number | undefined, env: RawNodesParserEnv): Promise<BuildChaptersResult> {
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
async function resolveRawNode(rawNode: RawBookNode, env: RawNodesParserEnv): Promise<ResultLast<BookContentNode>> {
    switch (rawNode.node) {
        case 'image-ref':
            const imageBuffer = await env.resolveImageRef(rawNode.imageId);
            if (imageBuffer) {
                return success({
                    node: 'image-data',
                    id: rawNode.imageId,
                    data: imageBuffer,
                });
            } else {
                fail({ custom: 'couldnt-resolve-ref', id: rawNode.imageId, context: 'image-node' });
            }
        case 'span':
        case 'attr':
        case 'ref':
            const span = spanFromRawNode(rawNode);
            if (span.success) {
                return success({
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
            return success({
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
