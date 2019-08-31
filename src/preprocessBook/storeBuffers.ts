import { VolumeNode, BookContentNode } from 'booka-common';
import { filterUndefined } from '../utils';

export type StoreBufferFn = (buffer: Buffer) => Promise<string | undefined>;
export async function storeBuffers(volume: VolumeNode, fn: StoreBufferFn): Promise<VolumeNode> {
    return {
        ...volume,
        nodes: await processNodes(volume.nodes, fn),
    };
}

async function processNodes(nodes: BookContentNode[], fn: StoreBufferFn): Promise<BookContentNode[]> {
    const result = await Promise.all(nodes.map(n => processNode(n, fn)));

    return filterUndefined(result);
}

async function processNode(node: BookContentNode, fn: StoreBufferFn): Promise<BookContentNode | undefined> {
    switch (node.node) {
        case 'image-data':
            const url = await fn(node.data);
            if (url) {
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
                nodes: await processNodes(node.nodes, fn),
            };
        default:
            return node;
    }
}
