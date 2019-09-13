import { VolumeNode, BookContentNode, Book, ImageRefNode, ImageDataNode, ImageNode } from 'booka-common';
import { filterUndefined } from '../utils';

export type StoreBufferFn = (buffer: Buffer, id: string, title?: string) => Promise<string | undefined>;
export type RestoreBufferFn = (imageRef: string, id: string) => Promise<Buffer | undefined>;
export type ProcessImagesArgs = {
    storeBuffer?: StoreBufferFn,
    restoreBuffer?: RestoreBufferFn,
};
export async function storeBuffers(book: Book, args: ProcessImagesArgs): Promise<Book> {
    const env: StoreBufferEnv = {
        title: book.volume.meta.title,
        args,
        resolved: {},
    };
    const processed = await processNodes(book.volume.nodes, env);
    const coverImageNode = book.volume.meta.coverImageNode && await resolveImageNode(book.volume.meta.coverImageNode, env);
    const volume: VolumeNode = {
        ...book.volume,
        meta: {
            ...book.volume.meta,
            coverImageNode: coverImageNode,
        },
        nodes: processed,
    };

    return {
        ...book,
        volume,
    };
}

type StoreBufferEnv = {
    title?: string,
    args: ProcessImagesArgs,
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
        case 'image-ref':
            return resolveImageNode(node, env);
        case 'chapter':
            return {
                ...node,
                nodes: await processNodes(node.nodes, env),
            };
        default:
            return node;
    }
}

async function resolveImageNode(node: ImageNode, env: StoreBufferEnv) {
    if (node.node === 'image-ref') {
        return resolveImageRef(node, env);
    } else {
        return resolveImageData(node, env);
    }
}

async function resolveImageRef(node: ImageRefNode, env: StoreBufferEnv): Promise<ImageNode | undefined> {
    if (env.args.restoreBuffer === undefined) {
        return node;
    }

    const buffer = await env.args.restoreBuffer(node.imageRef, node.imageId);
    if (buffer) {
        return {
            node: 'image-data',
            imageId: node.imageId,
            data: buffer,
        };
    } else {
        // TODO: report errors ?
        return undefined;
    }
}

async function resolveImageData(node: ImageDataNode, env: StoreBufferEnv): Promise<ImageNode | undefined> {
    if (env.args.storeBuffer === undefined) {
        return node;
    }

    const stored = env.resolved[node.imageId];
    const url = stored || await env.args.storeBuffer(node.data, node.imageId, env.title);
    if (url) {
        env.resolved[node.imageId] = url;
        return {
            node: 'image-ref',
            imageId: node.imageId,
            imageRef: url,
        };
    } else {
        return undefined;
    }
}
