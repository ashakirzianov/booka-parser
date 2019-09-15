import {
    Book, ImageRefNode, ImageDataNode, ImageNode, processImagesAsync,
} from 'booka-common';

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

    const processedVolume = await processImagesAsync(
        book.volume,
        imageNode => resolveImageNode(imageNode, env),
    );

    return {
        ...book,
        volume: processedVolume,
    };
}

type StoreBufferEnv = {
    title?: string,
    args: ProcessImagesArgs,
    resolved: {
        [key: string]: string | undefined,
    },
};

async function resolveImageNode(node: ImageNode, env: StoreBufferEnv) {
    if (node.node === 'image-ref') {
        return resolveImageRef(node, env);
    } else {
        return resolveImageData(node, env);
    }
}

async function resolveImageRef(node: ImageRefNode, env: StoreBufferEnv): Promise<ImageNode> {
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
        return node;
    }
}

async function resolveImageData(node: ImageDataNode, env: StoreBufferEnv): Promise<ImageNode> {
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
        return node;
    }
}
