import { EpubBook } from './epubFileParser';
import { Book, extractNodeText } from 'booka-common';
import { xmlStringParser, extractAllText } from '../xml';
import { ParserDiagnostic, SuccessLast, yieldLast } from '../combinators';

export async function processConsistency(book: Book, epub: EpubBook): Promise<SuccessLast<Book>> {
    const epubText = removeWhitespaces(
        await extractEpubText(epub),
    );
    const bookText = removeWhitespaces(
        book.volume.nodes
            .map(extractNodeText)
            .join(''),
    );
    const ratio = bookText.length / epubText.length;
    const diag: ParserDiagnostic = ratio < 0.95
        ? {
            diag: 'low text ratio',
            ratio: Math.floor(ratio * 100),
        }
        : undefined;
    return yieldLast(book, diag);
}

async function extractEpubText(epub: EpubBook): Promise<string> {
    let result = '';
    for await (const section of epub.sections()) {
        result += extractXmlText(section.content);
    }
    return result;
}

function extractXmlText(xmlString: string): string {
    const xml = xmlStringParser({
        xmlString: xmlString,
    });
    return xml.success
        ? extractAllText(xml.value)
        : '';
}

function removeWhitespaces(str: string): string {
    // TODO: implement
    return str;
}
