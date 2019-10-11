import {
    processBookImages,
} from 'booka-common';
import {
    yieldLast, ParserDiagnostic, compoundDiagnostic,
} from '../../combinators';
import { PreprocessorArgs } from './preprocessor';

export async function images({ book, epub }: PreprocessorArgs) {
    const diags: ParserDiagnostic[] = [];
    const resolvedVolume = await processBookImages(book, async image => {
        if (image.kind === 'ref') {
            const buffer = await epub.imageResolver(image.ref);
            if (buffer) {
                return {
                    ...image,
                    kind: 'buffer',
                    imageId: image.imageId,
                    buffer: buffer,
                };
            } else {
                diags.push({
                    diag: 'couldnt-resolve-image',
                    id: image.imageId,
                });
                return image;
            }
        } else {
            return image;
        }
    });
    const resolved = {
        ...book,
        volume: resolvedVolume,
    };
    return yieldLast(resolved, compoundDiagnostic(diags));
}
