import {
    BookContentNode, Span, ChapterNode, VolumeNode, BookMeta,
    RawBookNode, TagNode, tagValue, assignAttributes, containedNodes, RawContainerNode,
} from 'booka-common';
import {
    flatten, filterUndefined, assertNever,
} from '../utils';
import { ParserDiagnoser } from '../log';

export type Block2BookEnv = {
    ds: ParserDiagnoser,
    resolveImageRef: (ref: string) => Promise<Buffer | undefined>,
};
export async function blocks2book(blocks: RawBookNode[], env: Block2BookEnv): Promise<VolumeNode> {
    const { rest, footnotes } = separateFootnoteContainers(blocks);
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

async function collectMeta(blocks: RawBookNode[], env: Block2BookEnv): Promise<Partial<BookMeta>> {
    const tags = blocks
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

function separateFootnoteContainers(blocks: RawBookNode[]) {
    const footnoteIds = flatten(blocks.map(collectFootnoteIds));
    return separateFootnoteContainersImpl(blocks, footnoteIds);
}

function collectFootnoteIds(block: RawBookNode): string[] {
    switch (block.node) {
        case 'ref':
            return [block.to];
        // TODO: collect from span node ?
        default:
            const nodes = containedNodes(block);
            return flatten(nodes.map(collectFootnoteIds));
    }
}

// TODO: review and re-implement
function separateFootnoteContainersImpl(blocks: RawBookNode[], footnoteIds: string[]) {
    const rest: RawBookNode[] = [];
    const footnotes: RawBookNode[] = [];
    for (const block of blocks) {
        if (footnoteIds.some(fid => fid === block.ref)) {
            footnotes.push(block);
        } else {
            const nodes = containedNodes(block);
            if (nodes.length > 0) {
                const inside = separateFootnoteContainersImpl(nodes, footnoteIds);
                if (inside.footnotes.length > 0) {
                    rest.push({
                        node: 'container',
                        nodes: inside.rest,
                    });
                    footnotes.push(...inside.footnotes);
                } else {
                    rest.push(block);
                }
            } else {
                rest.push(block);
            }
        }
    }

    return { rest, footnotes };
}

function preprocess(blocks: RawBookNode[]): RawBookNode[] {
    const result: RawBookNode[] = [];
    for (const block of blocks) {
        switch (block.node) {
            case 'container':
                const preprocessed = {
                    ...block,
                    content: preprocess(block.nodes),
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
                result.push(block);
                break;
        }
    }

    return result;
}

function shouldBeFlatten(container: RawContainerNode): boolean {
    return !container.nodes.some(b => (b.node === 'span') || b.node === 'attr');
}

type Env = Block2BookEnv & {
    footnotes: RawBookNode[],
};

async function buildChapters(blocks: RawBookNode[], env: Env) {
    const { nodes, next } = await buildChaptersImpl(blocks, undefined, env);

    if (next.length !== 0) {
        env.ds.add({ diag: 'extra-blocks-tail', nodes: blocks });
    }

    return nodes;
}

type BuildChaptersResult = {
    nodes: BookContentNode[],
    next: RawBookNode[],
};
async function buildChaptersImpl(blocks: RawBookNode[], level: number | undefined, env: Env): Promise<BuildChaptersResult> {
    if (blocks.length === 0) {
        return { nodes: [], next: [] };
    }
    const block = blocks[0];
    if (block.node === 'title') {
        if (level === undefined || level > block.level) {
            const content = await buildChaptersImpl(blocks.slice(1), block.level, env);
            const chapter: ChapterNode = {
                node: 'chapter',
                nodes: content.nodes,
                title: block.title,
                level: block.level,
            };
            const after = await buildChaptersImpl(content.next, level, env);
            return {
                nodes: [chapter as BookContentNode].concat(after.nodes),
                next: after.next,
            };
        } else {
            return {
                nodes: [],
                next: blocks,
            };
        }
    } else {
        const node = await nodeFromBlock(block, env);
        const after = await buildChaptersImpl(blocks.slice(1), level, env);
        return {
            nodes: node ? [node].concat(after.nodes) : after.nodes,
            next: after.next,
        };
    }
}

async function nodeFromBlock(block: RawBookNode, env: Env): Promise<BookContentNode | undefined> {
    switch (block.node) {
        case 'image-ref':
            const imageBuffer = await env.resolveImageRef(block.imageId);
            if (imageBuffer) {
                return {
                    node: 'image-data',
                    id: block.imageId,
                    data: imageBuffer,
                };
            } else {
                env.ds.add({ diag: 'couldnt-resolve-ref', id: block.imageId, context: 'image-node' });
                return undefined;
            }
        case 'span':
        case 'attr':
        case 'ref':
            const span = spanFromBlock(block, env);
            if (span) {
                return {
                    node: 'paragraph',
                    span: span,
                };
            } else {
                return undefined;
            }
        case 'container':
            const spans = filterUndefined(block.nodes
                .map(c => spanFromBlock(c, env)));
            return {
                node: 'paragraph',
                span: {
                    span: 'compound',
                    spans: spans,
                },
            };
        default:
            env.ds.add({ diag: 'unexpected-raw-node', node: block, context: 'node' });
            return undefined;
    }
}

function spanFromBlock(block: RawBookNode, env: Env): Span | undefined {
    switch (block.node) {
        case 'span':
            return block.span;
        case 'attr':
            const attrSpan = spanFromBlock(block.content, env);
            if (attrSpan !== undefined) {
                return assignAttributes(...block.attributes)(attrSpan);
            } else {
                env.ds.add({ diag: 'couldnt-build-span', node: block, context: 'attr' });
                return undefined;
            }
        case 'ref':
            const footnoteContainer = env.footnotes.find(f => f.ref === block.to);
            if (footnoteContainer) {
                // TODO: extract title from content
                const content = spanFromBlock(block.content, env);
                if (!content) {
                    env.ds.add({ diag: 'couldnt-build-span', node: block, context: 'footnote' });
                    return undefined;
                }
                // TODO: re-implement
                // const footnote = spanFromBlock(footnoteContainer.content, env);
                // if (!footnote) {
                //     env.ds.add({ diag: 'couldnt-build-span', block, context: 'footnote' });
                //     return undefined;
                // }
                return {
                    span: 'note',
                    id: block.to,
                    content,
                    footnote: '',
                    title: [],
                };
            } else {
                env.ds.add({ diag: 'couldnt-resolve-ref', id: block.to, context: 'footnote' });
                return undefined;
            }
        case 'container':
            const spans = filterUndefined(block.nodes.map(c => spanFromBlock(c, env)));
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
            env.ds.add({ diag: 'unexpected-raw-node', node: block, context: 'span' });
            return undefined;
        default:
            env.ds.add({ diag: 'unexpected-raw-node', node: block, context: 'span' });
            assertNever(block);
            return undefined;
    }
}
