import {
    processBookImages, Image, ImageDic, assertNever,
} from 'booka-common';
import {
    yieldLast, Diagnostic, compoundDiagnostic,
} from '../../combinators';
import { PreprocessorArgs } from './preprocessor';

export async function images({ book, epub }: PreprocessorArgs) {
    const diags: Diagnostic[] = [];
    const imageDic: ImageDic = {};
    const resolved = await processBookImages(book, async image => {
        switch (image.image) {
            case 'ref':
                {
                    const buffer = await epub.imageResolver(image.imageId);
                    if (buffer) {
                        const imageBuffer: Image = {
                            ...image,
                            image: 'buffer',
                            imageId: image.imageId,
                            buffer: buffer,
                        };
                        imageDic[image.imageId] = imageBuffer;
                        return image;
                    } else {
                        diags.push({
                            diag: 'couldnt-resolve-image',
                            id: image.imageId,
                        });
                        return image;
                    }
                }
                break;
            case 'buffer':
                {
                    imageDic[image.imageId] = image;
                    const imageRef: Image = {
                        image: 'ref',
                        imageId: image.imageId,
                        title: image.title,
                    };
                    return imageRef;
                }
                break;
            case 'external':
                return image;
            default:
                assertNever(image);
                return image;
        }
    });
    return yieldLast({
        ...resolved,
        images: imageDic,
    }, compoundDiagnostic(diags));
}
