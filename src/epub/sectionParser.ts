import { flatten, BookContentNode } from 'booka-common';
import {
    node, xmlChildren, path,
} from '../xmlTreeParser';
import {
    makeStream, headParser, translate, yieldLast,
    pipe, some, reportUnparsedTail, ResultLast,
} from '../combinators';
import { AsyncIter } from '../utils';
import { EpubSection, EpubBook } from './epubFileParser';
import { xmlStringParser, tree2String } from '../xmlStringParser';
import { buildInterms2nodes } from '../intermediate';

export async function epub2nodes(epub: EpubBook): Promise<ResultLast<BookContentNode[]>> {
    const sectionsStream = makeStream(await AsyncIter.toArray(epub.sections()));

    const interms2nodes = buildInterms2nodes(epub);
    const singleSection = pipe(section2interms, interms2nodes);

    const sections = reportUnparsedTail(some(headParser(singleSection)), tail => ({
        diag: 'unexpected-sections',
        sections: tail.stream,
    }));

    const fullEpubParser = translate(
        sections,
        els => flatten(els),
    );

    return fullEpubParser(sectionsStream);
}

const body = xmlChildren(reportUnparsedTail(
    some(node),
    tail => ({
        diag: 'unexpected-xml',
        xml: tail.stream.map(tree2String),
    }),
));
const document2interms = path(['html', 'body'], body);

const section2interms = pipe(
    (section: EpubSection) => {
        const xmlDocument = xmlStringParser({
            xmlString: section.content,
            removeTrailingWhitespaces: false,
        });
        if (!xmlDocument.success) {
            return xmlDocument;
        } else {
            return yieldLast({
                filePath: section.filePath,
                document: xmlDocument.value,
            });
        }
    },
    ({ filePath, document }) => {
        const docStream = makeStream(document.children);
        const result = document2interms(docStream);
        if (result.success) {
            const stream = makeStream(result.value, {
                filePath,
            });
            return yieldLast(stream, result.diagnostic);
        } else {
            return result;
        }
    },
);
