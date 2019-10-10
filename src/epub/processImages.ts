import { Book, processVolumeImages } from 'booka-common';
import { SuccessLast, yieldLast, ParserDiagnostic, compoundDiagnostic } from '../combinators';
import { EpubBook } from './epubFileParser';

export async function processImages(epub: EpubBook, book: Book): Promise<SuccessLast<Book>> {
    const diags: ParserDiagnostic[] = [];
    const resolvedVolume = await processVolumeImages(book.volume, async image => {
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
