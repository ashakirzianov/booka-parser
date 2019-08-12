import { EpubConverterOptions, element2block } from './epubConverter';
import { isTextNode, isElement, XmlNodeWithChildren } from '../xml';

export const fictionBookEditorHooks: EpubConverterOptions = {
    nodeHooks: [
        titleElement(),
    ],
};

function titleElement() {
    function extractTextLines(node: XmlNodeWithChildren): string[] {
        const result: string[] = [];
        for (const ch of node.children) {
            if (isElement(ch)) {
                result.push(...extractTextLines(ch));
            } else if (isTextNode(ch)) {
                if (!ch.text.startsWith('\n')) {
                    result.push(ch.text);
                }
            }
        }

        return result;
    }

    return element2block(el => {
        if (el.name !== 'div') {
            return undefined;
        }

        const className = el.attributes.class;
        if (className && className.startsWith('title')) {
            const levelStr = className === 'title'
                ? '0'
                : className.substr('title'.length);
            const level = parseInt(levelStr, 10);
            // TODO: add diagnostics here ?
            if (!isNaN(level)) {
                const title = extractTextLines(el);
                if (title) {
                    return {
                        block: 'chapter-title',
                        level: 1 - level,
                        title,
                    };
                }
            }
        }

        return undefined;
    });
}
