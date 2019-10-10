import { BookContentNode, extractNodeText } from 'booka-common';
import {
    ResultLast, SuccessLast, compoundDiagnostic, yieldLast, ParserDiagnostic,
} from '../combinators';
import { EpubSection, EpubBook } from './epubFileParser';
import { xmlStringParser } from '../xmlStringParser';
import { documentParser } from '../xml2nodes';

export async function epub2nodes(epub: EpubBook): Promise<ResultLast<BookContentNode[]>> {
    const diags: ParserDiagnostic[] = [];
    const content: BookContentNode[] = [];
    for await (const section of epub.sections()) {
        const result = sectionParser(section);
        diags.push(result.diagnostic);
        content.push(...result.value);
    }

    return yieldLast(content, compoundDiagnostic(diags));
}

function sectionParser(section: EpubSection): SuccessLast<BookContentNode[]> {
    const xmlDocument = xmlStringParser({
        xmlString: section.content,
        removeTrailingWhitespaces: false,
    });
    if (!xmlDocument.success) {
        return yieldLast([], {
            diag: 'couldnt parse xml',
            xmlDiag: xmlDocument.diagnostic,
        });
    }

    return documentParser(xmlDocument.value, {});
}
