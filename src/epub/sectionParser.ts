import { BookNode } from 'booka-common';
import {
    Result, Success, compoundDiagnostic, success, Diagnostic,
} from '../combinators';
import { EpubSection, EpubBook } from './epubFileParser';
import { xmlStringParser } from '../xml';
import { documentParser, XmlHooks } from '../xml2nodes';

export async function epub2nodes(epub: EpubBook, hooks: XmlHooks | undefined): Promise<Result<BookNode[]>> {
    const diags: Diagnostic[] = [];
    const content: BookNode[] = [];

    for await (const section of epub.sections()) {
        const result = sectionParser(section, hooks);
        diags.push(result.diagnostic);
        content.push(...result.value);
    }

    return success(content, compoundDiagnostic(diags));
}

function sectionParser(section: EpubSection, hooks: XmlHooks | undefined): Success<BookNode[]> {
    const xmlDocument = xmlStringParser({
        xmlString: section.content,
        removeTrailingWhitespaces: false,
    });
    if (!xmlDocument.success) {
        return success([], {
            diag: 'couldnt parse xml',
            xmlDiag: xmlDocument.diagnostic,
        });
    }

    return documentParser(xmlDocument.value, {
        filePath: section.filePath,
        hooks,
    });
}
