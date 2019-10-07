import { flatten, BookContentNode } from 'booka-common';
import {
    node, xmlChildren, path,
} from '../xmlTreeParser';
import {
    makeStream, headParser, translate, yieldLast,
    pipe, some, reportUnparsedTail, ResultLast,
} from '../combinators';
import { AsyncIter } from '../utils';
import { EpubSection, EpubBook } from './epubBook';
import { xmlStringParser, tree2String } from '../xmlStringParser';
import { interms2nodes } from '../intermediate/intermediateParser';

export async function epub2nodes(epub: EpubBook): Promise<ResultLast<BookContentNode[]>> {
    const sectionsStream = makeStream(await AsyncIter.toArray(epub.sections()));

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
        const docStream = makeStream(document.children);
        const interms = document2interms(docStream);
        return interms.success
            ? yieldLast({
                filePath,
                interms: interms.value,
            }, interms.diagnostic)
            : interms;
    },
    ({ filePath, interms }) => interms2nodes({ filePath, interms }),
);

const sections = reportUnparsedTail(some(headParser(singleSection)), tail => ({
    diag: 'unexpected-sections',
    sections: tail.stream,
}));

const fullEpubParser = translate(
    sections,
    els => flatten(els),
);
