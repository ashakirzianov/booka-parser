import { BookContentNode } from 'booka-common';
import {
    StreamParser, pipe,
} from '../combinators';
import { IntermTop, } from './intermediateNode';
import { EpubBook } from '../epub';
import { convertInterms } from './convertInterms';
import { buildPreprocessor } from './preprocessor';
import { gutenberg } from './pre.gutenberg';
import { fictionBookEditorRes } from './pre.fictionBookEditor';
import { fb2epubRes } from './pre.fb2epub';

type Interms2NodesParser = StreamParser<IntermTop, BookContentNode[], {
    filePath: string,
}>;
export function buildInterms2nodes(epub: EpubBook): Interms2NodesParser {
    const resolvers = [
        gutenberg, fb2epubRes, fictionBookEditorRes,
    ];
    const preprocessor = buildPreprocessor(epub, resolvers);

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
