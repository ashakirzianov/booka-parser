import {
    processBookImages, Image, ImageDic, assertNever,
    success, Diagnostic, compoundDiagnostic,
} from 'booka-common';
import { PreprocessorArgs } from './preprocessor';

export async function images({ book, epub }: PreprocessorArgs) {
    try {

        const diags: Diagnostic[] = [];
        const imageDic: ImageDic = {};
        const resolved = await processBookImages(book, async image => {
            switch (image.image) {
                case 'ref':
                    {
                        const buffer = await epub.imageResolver(image.imageId);
                        const base64 = buffer && Buffer.from(buffer).toString('base64');
                        if (base64) {
                            const imageBuffer: Image = {
                                ...image,
                                image: 'buffer',
                                imageId: image.imageId,
                                base64,
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
        return success({
            ...resolved,
            images: imageDic,
        }, compoundDiagnostic(diags));
    } catch (exception) {
        return success(book, {
            diag: 'exception while resolving images',
            exception,
        });
    }
}
