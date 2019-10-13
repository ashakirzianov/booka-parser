import { BookNode } from 'booka-common';
import {
    ResultLast, SuccessLast, compoundDiagnostic, yieldLast, ParserDiagnostic,
} from '../combinators';
import { EpubSection, EpubBook } from './epubFileParser';
import { xmlStringParser } from '../xml';
import { documentParser, XmlHooks } from '../xml2nodes';

export async function epub2nodes(epub: EpubBook, hooks: XmlHooks | undefined): Promise<ResultLast<BookNode[]>> {
    const diags: ParserDiagnostic[] = [];
    const content: BookNode[] = [];

    for await (const section of epub.sections()) {
        const result = sectionParser(section, hooks);
        diags.push(result.diagnostic);
        content.push(...result.value);
    }

    return yieldLast(content, compoundDiagnostic(diags));
}

function sectionParser(section: EpubSection, hooks: XmlHooks | undefined): SuccessLast<BookNode[]> {
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

    return documentParser(xmlDocument.value, {
        filePath: section.filePath,
        hooks,
    });
}
