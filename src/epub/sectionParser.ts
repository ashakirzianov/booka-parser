import { BookNode } from 'booka-common';
import {
    ResultLast, SuccessLast, compoundDiagnostic, yieldLast, ParserDiagnostic,
} from '../combinators';
import { EpubSection, EpubBook } from './epubFileParser';
import { xmlStringParser } from '../xml';
import { documentParser, Hooks } from '../xml2nodes';
import { resolveHooks, HooksProvider } from './hooks';
import { gutenberg } from './hooks.gutenberg';
import { fb2epub } from './hooks.fb2epub';
import { fictionBookEditor } from './hooks.fictionBookEditor';

export async function epub2nodes(epub: EpubBook): Promise<ResultLast<BookNode[]>> {
    const diags: ParserDiagnostic[] = [];
    const content: BookNode[] = [];

    const hooksProviders: HooksProvider[] = [
        gutenberg, fb2epub, fictionBookEditor,
    ];
    const hooks = resolveHooks(epub, hooksProviders);
    if (hooks === undefined) {
        diags.push({
            diag: 'unknown book kind',
            meta: epub.rawMetadata,
        });
    }

    for await (const section of epub.sections()) {
        const result = sectionParser(section, hooks);
        diags.push(result.diagnostic);
        content.push(...result.value);
    }

    return yieldLast(content, compoundDiagnostic(diags));
}

function sectionParser(section: EpubSection, hooks: Hooks | undefined): SuccessLast<BookNode[]> {
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
