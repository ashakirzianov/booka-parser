import { PreResolver, IntermPreprocessor } from './common';
import { reject, ParserDiagnostic, headParser, yieldLast } from '../combinators';
import { IntermNode } from './intermediateNode';
import { assertNever } from 'booka-common';

const expectAttrs: IntermPreprocessor = headParser(node => {
    const diag = diagnoseAttrs(node);
    return yieldLast([node], diag);
});

function diagnoseAttrs(node: IntermNode): ParserDiagnostic {
    switch (node.interm) {
        case 'text': case 'a': case 'span': case 'quote': case 'ins': case 'image':
        case 'bold': case 'italic': case 'small': case 'big': case 'sub': case 'sup':
            return undefined;
        case 'pph':
            return undefined;
        case 'table': case 'row': case 'cell':
            return undefined;
        case 'list': case 'item':
            return undefined;
        case 'header': case 'separator':
            return undefined;
        case 'container':
            return undefined;
        case 'ignore':
            return undefined;
        default:
            assertNever(node);
            return undefined;
    }
}

const gutenbergPrep: IntermPreprocessor = expectAttrs;

export const gutenberg: PreResolver = ({ rawMetadata }) => {
    if (!rawMetadata) {
        return undefined;
    }

    const gutenbergUrl = 'http://www.gutenberg.org';
    const source = rawMetadata['dc:source'];
    const isGutenbergSource = typeof source === 'string'
        && source.startsWith(gutenbergUrl);
    if (isGutenbergSource) {
        return gutenbergPrep;
    }
    const id = rawMetadata['dc:identifier'];
    const marker = id && id['#'];
    const isMarked = typeof marker === 'string'
        && marker.startsWith(gutenbergUrl);

    return isMarked
        ? gutenbergPrep
        : undefined;
};
