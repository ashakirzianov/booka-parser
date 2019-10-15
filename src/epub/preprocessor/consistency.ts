import {
    extractBookText,
} from 'booka-common';
import {
    yieldLast, Diagnostic,
} from '../../combinators';
import { xmlStringParser, extractAllText } from '../../xml';
import { EpubBook } from '../epubFileParser';
import { PreprocessorArgs } from './preprocessor';

export async function consistency({ book, epub }: PreprocessorArgs) {
    const epubText = await extractEpubText(epub);
    const bookText = extractBookText(book);
    const ratio = bookText.length / epubText.length;
    const diag: Diagnostic = ratio < 0.95
        ? {
            diag: 'low text ratio',
            severity: 'warning',
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
