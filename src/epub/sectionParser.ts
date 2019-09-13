import { path, xmlChildren } from '../xmlStringParser';
import {
    choice, makeStream, fullParser, headParser,
    translate, some, expected, flattenResult, yieldLast,
    StreamParser, diagnosticContext,
} from '../combinators';
import { flatten, AsyncIter } from '../utils';
import { EpubSection } from './epubBook';
import { EpubBookParser } from './epubBookParser';
import { BookElement } from '../bookElementParser';
import { span } from './spanParser';
import { nodeParser } from './nodeParser';

export type SectionsParser = StreamParser<EpubSection, BookElement[], undefined>;

export const sectionsParser: EpubBookParser<BookElement[]> = async input => {
    const hooks = input.options[input.epub.kind];
    const nodeParser2 = choice(...hooks.nodeHooks, nodeParser);
    const insideParser = flattenResult(fullParser(nodeParser2));
    const bodyParser = xmlChildren(insideParser);
    const documentParser = path(['html', 'body'], bodyParser);
    const withDiags = expected(documentParser, [], stream => ({
        diag: 'couldnt-parse-document',
        tree: stream && stream.stream,
    }));

    const parser: StreamParser<EpubSection, BookElement[]> = translate(
        some(headParser(s => {
            const docStream = makeStream(s.content.children, {
                filePath: s.filePath,
                recursive: nodeParser,
                span: span,
            });
            const withContext = diagnosticContext(withDiags, {
                filePath: s.filePath,
            });
            const res = withContext(docStream);
            return res.success
                ? res
                : yieldLast([] as BookElement[], { diag: 'couldnt-parse-section', section: s, inside: res.diagnostic });
        })),
        nns => flatten(nns),
    );

    const sections = await AsyncIter.toArray(input.epub.sections());
    return parser(makeStream(sections));
};
