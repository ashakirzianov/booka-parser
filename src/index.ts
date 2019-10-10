import { epubParser } from './epub';
import {
    ResultLast, translateAsync, catchExceptionsAsync,
} from './combinators';
import { Book } from 'booka-common';

export {
    Result, ResultLast,
    isCompoundDiagnostic, isEmptyDiagnostic, ParserDiagnostic,
} from './combinators';

export const parserVersion = '1.1.2';

export type ParseEpubInput = {
    filePath: string,
};
export type ParseEpubOutput = {
    book: Book,
};

export async function parseEpub({ filePath }: ParseEpubInput): Promise<ResultLast<ParseEpubOutput>> {
    const parser = catchExceptionsAsync(translateAsync(
        epubParser,
        async book => {

            const output: ParseEpubOutput = {
                book,
            };

            return output;
        }
    ));

    return parser({ filePath });
}
