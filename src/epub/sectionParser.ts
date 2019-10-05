import { flatten } from 'booka-common';
import {
    buildDocumentParser, span, nodeParser, paragraphNode, TreeParserEnv,
} from '../xmlTreeParser';
import {
    makeStream, headParser, translate, expected, yieldLast,
    StreamParser, pipe, AsyncFullParser, choice, some, reportUnparsedTail,
} from '../combinators';
import { AsyncIter } from '../utils';
import { EpubSection, EpubBook } from './epubBook';
import { BookElement } from '../bookElementParser';
import { xmlStringParser, XmlTree } from '../xmlStringParser';
import { epubParserHooks } from './hooks';

export type SectionsParser = StreamParser<EpubSection, BookElement[], undefined>;

export const sectionsParser: AsyncFullParser<EpubBook, BookElement[]> = async epub => {
    const hooks = epubParserHooks[epub.kind];
    const nodeParserWithHooks = choice(...hooks.nodeHooks, nodeParser);
    const documentParser = buildDocumentParser(nodeParserWithHooks);
    const withDiags = expected(documentParser, [], stream => ({
        diag: 'couldnt-parse-document',
        tree: stream && stream.stream,
    }));

    const singleSection = pipe(
        (section: EpubSection) => {
            const xmlDocument = xmlStringParser({
                xmlString: section.content,
                removeTrailingWhitespaces: false,
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
            const docStream = makeStream<XmlTree, TreeParserEnv>(document.children, {
                filePath: filePath,
                nodeParser: nodeParserWithHooks,
                paragraphParser: paragraphNode,
                spanParser: span,
            });
            const res = withDiags(docStream);
            return res.success
                ? res
                : yieldLast([] as BookElement[], { diag: 'couldnt-parse-section', filePath, inside: res.diagnostic });
        },
    );

    const full = translate(
        reportUnparsedTail(some(headParser(singleSection)), tail => ({
            diag: 'unexpected-sections',
            sections: tail.stream,
        })),
        els => flatten(els),
    );

    const sections = await AsyncIter.toArray(epub.sections());
    return full(makeStream(sections));
};
