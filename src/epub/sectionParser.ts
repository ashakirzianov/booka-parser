import { flatten } from 'booka-common';
import { buildDocumentParser, span, nodeParser } from '../xmlTreeParser';
import {
    makeStream, headParser,
    translate, expected, yieldLast,
    StreamParser, pipe, fullParser, AsyncFullParser,
} from '../combinators';
import { AsyncIter } from '../utils';
import { EpubSection, EpubBook } from './epubBook';
import { BookElement } from '../bookElementParser';
import { xmlStringParser } from '../xmlStringParser';
import { epubParserHooks } from './hooks';

export type SectionsParser = StreamParser<EpubSection, BookElement[], undefined>;

export const sectionsParser: AsyncFullParser<EpubBook, BookElement[]> = async epub => {
    const hooks = epubParserHooks[epub.kind];
    const documentParser = buildDocumentParser(hooks.nodeHooks);
    const withDiags = expected(documentParser, [], stream => ({
        diag: 'couldnt-parse-document',
        tree: stream && stream.stream,
    }));

    const singleSection = pipe(
        (section: EpubSection) => {
            const xmlDocument = xmlStringParser({
                xmlString: section.content,
                removeTrailingWhitespaces: true,
            });
            if (!xmlDocument.success) {
                return xmlDocument;
            }

            return yieldLast({
                filePath: section.filePath,
                document: xmlDocument.value,
            });
        },
        ({ filePath, document }) => {
            const docStream = makeStream(document.children, {
                filePath: filePath,
                recursive: nodeParser,
                span: span,
            });
            const res = withDiags(docStream);
            return res.success
                ? res
                : yieldLast([] as BookElement[], { diag: 'couldnt-parse-section', filePath, inside: res.diagnostic });
        },
    );

    const full = translate(
        fullParser(headParser(singleSection)),
        els => flatten(els),
    );

    const sections = await AsyncIter.toArray(epub.sections());
    return full(makeStream(sections));
};
