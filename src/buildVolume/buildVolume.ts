import {
    BookContentNode, Span, ChapterNode, VolumeNode, BookMeta,
    RawBookNode, TagNode, tagValue, assignAttributes, containedNodes, RawContainerNode,
} from 'booka-common';
import {
    flatten, filterUndefined, assertNever,
} from '../utils';
import { ParserDiagnoser } from '../log';

export type BuildVolumeEnv = {
    ds: ParserDiagnoser,
    resolveImageRef: (ref: string) => Promise<Buffer | undefined>,
};
export async function buildVolume(rawNodes: RawBookNode[], env: BuildVolumeEnv): Promise<VolumeNode> {
    const { rest, footnotes } = separateFootnoteContainers(rawNodes);
    const meta = await collectMeta(rest, env);
    const preprocessed = preprocess(rest);
    const nodes = await buildChapters(preprocessed, { ...env, footnotes });

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

function separateFootnoteContainers(rawNodes: RawBookNode[]) {
    const footnoteIds = flatten(rawNodes.map(collectFootnoteIds));
    return separateFootnoteContainersImpl(rawNodes, footnoteIds);
}

function collectFootnoteIds(rawNode: RawBookNode): string[] {
    switch (rawNode.node) {
        case 'ref':
            return [rawNode.to];
        // TODO: collect from span node ?
        default:
            const nodes = containedNodes(rawNode);
            return flatten(nodes.map(collectFootnoteIds));
    }
}

// TODO: review and re-implement
function separateFootnoteContainersImpl(rawNodes: RawBookNode[], footnoteIds: string[]) {
    const rest: RawBookNode[] = [];
    const footnotes: RawBookNode[] = [];
    for (const node of rawNodes) {
        if (footnoteIds.some(fid => fid === node.ref)) {
            footnotes.push(node);
        } else {
            const contained = containedNodes(node);
            if (contained.length > 0) {
                const inside = separateFootnoteContainersImpl(contained, footnoteIds);
                if (inside.footnotes.length > 0) {
                    rest.push({
                        node: 'container',
                        nodes: inside.rest,
                    });
                    footnotes.push(...inside.footnotes);
                } else {
                    rest.push(node);
                }
            } else {
                rest.push(node);
            }
        }
    }

    return { rest, footnotes };
}

function preprocess(rawNodes: RawBookNode[]): RawBookNode[] {
    const result: RawBookNode[] = [];
    for (const node of rawNodes) {
        switch (node.node) {
            case 'container':
                const preprocessed = {
                    ...node,
                    content: preprocess(node.nodes),
                };
                if (shouldBeFlatten(preprocessed)) {
                    result.push(...preprocessed.content);
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
    return !container.nodes.some(b => (b.node === 'span') || b.node === 'attr');
}

type Env = BuildVolumeEnv & {
    footnotes: RawBookNode[],
};

async function buildChapters(rawNodes: RawBookNode[], env: Env) {
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
async function buildChaptersImpl(rawNodes: RawBookNode[], level: number | undefined, env: Env): Promise<BuildChaptersResult> {
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

async function resolveRawNode(rawNode: RawBookNode, env: Env): Promise<BookContentNode | undefined> {
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
            const span = spanFromRawNode(rawNode, env);
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
                .map(c => spanFromRawNode(c, env)));
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

function spanFromRawNode(rawNode: RawBookNode, env: Env): Span | undefined {
    switch (rawNode.node) {
        case 'span':
            return rawNode.span;
        case 'attr':
            const attrSpan = spanFromRawNode(rawNode.content, env);
            if (attrSpan !== undefined) {
                return assignAttributes(...rawNode.attributes)(attrSpan);
            } else {
                env.ds.add({ diag: 'couldnt-build-span', node: rawNode, context: 'attr' });
                return undefined;
            }
        case 'ref':
            const footnoteContainer = env.footnotes.find(f => f.ref === rawNode.to);
            if (footnoteContainer) {
                // TODO: extract title from content
                const content = spanFromRawNode(rawNode.content, env);
                if (!content) {
                    env.ds.add({ diag: 'couldnt-build-span', node: rawNode, context: 'footnote' });
                    return undefined;
                }
                // TODO: re-implement
                // const footnote = spanFromBlock(footnoteContainer.content, env);
                // if (!footnote) {
                //     env.ds.add({ diag: 'couldnt-build-span', node: rawNode, context: 'footnote' });
                //     return undefined;
                // }
                return {
                    span: 'note',
                    id: rawNode.to,
                    content,
                    footnote: '',
                    title: [],
                };
            } else {
                env.ds.add({ diag: 'couldnt-resolve-ref', id: rawNode.to, context: 'footnote' });
                return undefined;
            }
        case 'container':
            const spans = filterUndefined(rawNode.nodes.map(c => spanFromRawNode(c, env)));
            return {
                span: 'compound',
                spans: spans,
            };
        case 'ignore':
            return undefined;
        case 'image-data':
        case 'image-ref':
        case 'image-url':
        case 'title':
        case 'tag':
            env.ds.add({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
            return undefined;
        default:
            env.ds.add({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
            assertNever(rawNode);
            return undefined;
    }
}
