import { BookContentNode } from 'booka-common';
import {
    StreamParser, pipe,
} from '../combinators';
import { IntermTop } from './intermediateNode';
import { EpubBook } from '../epub';
import { convertInterms } from './convertInterms';
import { buildPreprocessor } from './preprocessor';

type Interms2NodesParser = StreamParser<IntermTop, BookContentNode[], {
    filePath: string,
}>;
export function buildInterms2nodes(epub: EpubBook): Interms2NodesParser {
    const preprocessor = buildPreprocessor(epub);

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
