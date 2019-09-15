import { buildDocumentParser, span, nodeParser } from '../xmlTreeParser';
import {
    makeStream, headParser,
    translate, expected, yieldLast,
    StreamParser, pipe, fullParser,
} from '../combinators';
import { flatten, AsyncIter } from '../utils';
import { EpubSection } from './epubBook';
import { EpubBookParser } from './epubBookParser';
import { BookElement } from '../bookElementParser';
import { xmlStringParser } from '../xmlStringParser';

export type SectionsParser = StreamParser<EpubSection, BookElement[], undefined>;

export const sectionsParser: EpubBookParser<BookElement[]> = async input => {
    const hooks = input.options[input.epub.kind];
    const documentParser = buildDocumentParser(hooks.nodeHooks);
    const withDiags = expected(documentParser, [], stream => ({
        diag: 'couldnt-parse-document',
        tree: stream && stream.stream,
    }));

    const singleSection = pipe(
        (section: EpubSection) => {
            const xmlDocument = xmlStringParser(section.content);
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

    const sections = await AsyncIter.toArray(input.epub.sections());
    return full(makeStream(sections));
};
