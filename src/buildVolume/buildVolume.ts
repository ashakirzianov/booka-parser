import {
    BookContentNode, ChapterNode, VolumeNode, BookMeta,
    RawBookNode, TagNode, tagValue, RawContainerNode,
} from 'booka-common';
import { filterUndefined } from '../utils';
import { ParserDiagnoser } from '../log';
import { spanFromRawNode } from './common';
import { resolveReferences } from './resolveReferences';

export type BuildVolumeEnv = {
    ds: ParserDiagnoser,
    resolveImageRef: (ref: string) => Promise<Buffer | undefined>,
};
export async function buildVolume(rawNodes: RawBookNode[], env: BuildVolumeEnv): Promise<VolumeNode> {
    const preprocessed = preprocess(rawNodes);
    const resolved = resolveReferences(preprocessed, env.ds);
    const meta = await collectMeta(resolved, env);
    const nodes = await buildChapters(resolved, env);

    if (meta.title === undefined) {
        env.ds.add({ diag: 'empty-book-title' });
    }

    return {
        node: 'volume',
        nodes,
        meta: {
            ...meta,
            title: meta.title || 'no-title',
        },
    };
}

async function collectMeta(rawNodes: RawBookNode[], env: BuildVolumeEnv): Promise<Partial<BookMeta>> {
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

function preprocess(rawNodes: RawBookNode[]): RawBookNode[] {
    const result: RawBookNode[] = [];
    for (const node of rawNodes) {
        switch (node.node) {
            case 'container':
                const preprocessed: RawContainerNode = {
                    ...node,
                    nodes: preprocess(node.nodes),
                };
                if (shouldBeFlatten(preprocessed)) {
                    result.push(...preprocessed.nodes);
                } else {
                    result.push(preprocessed);
                }
                break;
            case 'tag':
            case 'ignore':
                break;
            default:
                result.push(node);
                break;
        }
    }

    return result;
}

function shouldBeFlatten(container: RawContainerNode): boolean {
    return !container.ref && !container.nodes.some(n => (n.node === 'span') || n.node === 'attr');
}

async function buildChapters(rawNodes: RawBookNode[], env: BuildVolumeEnv) {
    const { nodes, next } = await buildChaptersImpl(rawNodes, undefined, env);

    if (next.length !== 0) {
        env.ds.add({ diag: 'extra-nodes-tail', nodes: rawNodes });
    }

    return nodes;
}

type BuildChaptersResult = {
    nodes: BookContentNode[],
    next: RawBookNode[],
};
async function buildChaptersImpl(rawNodes: RawBookNode[], level: number | undefined, env: BuildVolumeEnv): Promise<BuildChaptersResult> {
    if (rawNodes.length === 0) {
        return { nodes: [], next: [] };
    }
    const headNode = rawNodes[0];
    if (headNode.node === 'title') {
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
            };
        } else {
            return {
                nodes: [],
                next: rawNodes,
            };
        }
    } else {
        const node = await resolveRawNode(headNode, env);
        const after = await buildChaptersImpl(rawNodes.slice(1), level, env);
        return {
            nodes: node ? [node].concat(after.nodes) : after.nodes,
            next: after.next,
        };
    }
}

async function resolveRawNode(rawNode: RawBookNode, env: BuildVolumeEnv): Promise<BookContentNode | undefined> {
    switch (rawNode.node) {
        case 'image-ref':
            const imageBuffer = await env.resolveImageRef(rawNode.imageId);
            if (imageBuffer) {
                return {
                    node: 'image-data',
                    id: rawNode.imageId,
                    data: imageBuffer,
                };
            } else {
                env.ds.add({ diag: 'couldnt-resolve-ref', id: rawNode.imageId, context: 'image-node' });
                return undefined;
            }
        case 'span':
        case 'attr':
        case 'ref':
            const span = spanFromRawNode(rawNode, env.ds);
            if (span) {
                return {
                    node: 'paragraph',
                    span: span,
                };
            } else {
                return undefined;
            }
        case 'container':
            const spans = filterUndefined(rawNode.nodes
                .map(c => spanFromRawNode(c, env.ds)));
            return {
                node: 'paragraph',
                span: {
                    span: 'compound',
                    spans: spans,
                },
            };
        default:
            env.ds.add({ diag: 'unexpected-raw-node', node: rawNode, context: 'node' });
            return undefined;
    }
}
