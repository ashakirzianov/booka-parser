import {
    Book, ImageNode, ImageData, ImageRefData, ImageBufferData, processNodeImagesAsync,
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

    const volume = await processNodeImagesAsync(
        book.volume,
        async image =>
            image.kind === 'ref'
                ? resolveImageRef(image, env)
                : resolveImageData(image, env),
    );

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

async function resolveImageRef(data: ImageRefData, env: StoreBufferEnv): Promise<ImageData> {
    if (env.args.restoreBuffer === undefined) {
        return data;
    }

    const buffer = await env.args.restoreBuffer(data.ref, data.imageId);
    if (buffer) {
        return {
            ...data,
            kind: 'buffer',
            buffer: buffer,
        };
    } else {
        return data;
    }
}

async function resolveImageData(data: ImageBufferData, env: StoreBufferEnv): Promise<ImageData> {
    if (env.args.storeBuffer === undefined) {
        return data;
    }

    const stored = env.resolved[data.imageId];
    const url = stored || await env.args.storeBuffer(data.buffer, data.imageId, env.title);
    if (url) {
        env.resolved[data.imageId] = url;
        return {
            ...data,
            kind: 'ref',
            ref: url,
        };
    } else {
        return data;
    }
}
