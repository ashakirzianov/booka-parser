import { VolumeNode, BookContentNode } from 'booka-common';
import { filterUndefined } from '../utils';

export type StoreBufferFn = (buffer: Buffer, id: string) => Promise<string | undefined>;
export async function storeBuffers(volume: VolumeNode, fn: StoreBufferFn): Promise<VolumeNode> {
    const processed = await processNodes(volume.nodes, {
        fn, resolved: {},
    });
    return {
        ...volume,
        nodes: processed,
    };
}

type StoreBufferEnv = {
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
            const stored = env.resolved[node.id];
            const url = stored || await env.fn(node.data, node.id);
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
        case 'chapter':
            return {
                ...node,
                nodes: await processNodes(node.nodes, env),
            };
        default:
            return node;
    }
}
