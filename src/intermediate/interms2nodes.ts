import { flatten, BookContentNode } from 'booka-common';
import {
    StreamParser, some, choice, headParser, yieldLast,
    translate, reject, pipe, makeStream,
} from '../combinators';
import { IntermTop, } from './intermediateNode';
import { EpubBook } from '../epub';
import { convertInterms } from './convertInterms';

export function buildInterms2nodes(epub: EpubBook): StreamParser<IntermTop, BookContentNode[], Env> {
    const hook = resolvePreprocessorHook(epub);
    const single = choice(hook, headParser(interm => yieldLast([interm])));
    const preprocessor = translate(
        some(single),
        (tops, stream) => makeStream(flatten(tops), stream.env),
    );

    return pipe(
        preprocessor,
        stream => {
            const result = convertInterms({
                interms: stream.stream,
                filePath: stream.env.filePath,
            });
            return result;
        },
    );
}

type Env = { filePath: string };
type IntermPreprocessor = StreamParser<IntermTop, IntermTop[], Env>;
const defaultPrep: IntermPreprocessor = () => reject();
function resolvePreprocessorHook(epub: EpubBook): IntermPreprocessor {
    return defaultPrep;
}

// const kindResolver: EpubKindResolver<EPub> = {
//     gutenberg: epub => {
//         const rawMetadata = getRawData(epub.metadata) as any;
//         if (!rawMetadata) {
//             return false;
//         }

//         const gutenbergUrl = 'http://www.gutenberg.org';
//         const source = rawMetadata['dc:source'];
//         const isGutenbergSource = typeof source === 'string'
//             && source.startsWith(gutenbergUrl);
//         if (isGutenbergSource) {
//             return isGutenbergSource;
//         }
//         const id = rawMetadata['dc:identifier'];
//         const marker = id && id['#'];
//         return typeof marker === 'string'
//             && marker.startsWith(gutenbergUrl);
//     },
//     fb2epub: epub => {
//         const rawMetadata = getRawData(epub.metadata) as any;
//         if (!rawMetadata) {
//             return false;
//         }

//         const contributor = rawMetadata['dc:contributor'];
//         if (!contributor || !Array.isArray(contributor)) {
//             return false;
//         }

//         const fb2epub = contributor
//             .map(i => i['#'])
//             .find(i => typeof i === 'string' && i.startsWith('Fb2epub'));

//         return fb2epub !== undefined;
//     },
//     fictionBookEditor: epub => {
//         const marker = epub.metadata['FB2.document-info.program-used'];
//         return marker !== undefined && marker.startsWith('FictionBook Editor');
//     },
// };
