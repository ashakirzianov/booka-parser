import { VolumeNode, BookContentNode, ImageDataNode, ImageUrlNode, ImageNode } from 'booka-common';
import { filterUndefined } from '../utils';

export type StoreBufferFn = (buffer: Buffer, id: string, title?: string) => Promise<string | undefined>;
export async function storeBuffers(volume: VolumeNode, fn: StoreBufferFn): Promise<VolumeNode> {
    const env: StoreBufferEnv = {
        title: volume.meta.title,
        fn,
        resolved: {},
    };
    const processed = await processNodes(volume.nodes, env);
    const coverImageNode = volume.meta.coverImageNode && await resolveImageData(volume.meta.coverImageNode, env);
    return {
        ...volume,
        meta: {
            ...volume.meta,
            coverImageNode: coverImageNode,
        },
        nodes: processed,
    };
}

type StoreBufferEnv = {
    title?: string,
    fn: StoreBufferFn,
    resolved: {
        [key: string]: string | undefined,
    },
};
async function processNodes(nodes: BookContentNode[], env: StoreBufferEnv): Promise<BookContentNode[]> {
    const result = await Promise.all(nodes.map(n => processNode(n, env)));

    return filterUndefined(result);
}

async function processNode(node: BookContentNode, env: StoreBufferEnv): Promise<BookContentNode | undefined> {
    switch (node.node) {
        case 'image-data':
            return resolveImageData(node, env);
        case 'chapter':
            return {
                ...node,
                nodes: await processNodes(node.nodes, env),
            };
        default:
            return node;
    }
}

async function resolveImageData(node: ImageNode, env: StoreBufferEnv): Promise<ImageUrlNode | undefined> {
    if (node.node === 'image-url') {
        return node;
    }

    const stored = env.resolved[node.id];
    const url = stored || await env.fn(node.data, node.id, env.title);
    if (url) {
        env.resolved[node.id] = url;
        return {
            node: 'image-url',
            id: node.id,
            url: url,
        };
    } else {
        return undefined;
    }
}
