import { PreResolver, IntermPreprocessor, diagnoseIntermAttrs, diagnoseInterm } from './common';
import { reject, ParserDiagnostic, headParser, yieldLast } from '../combinators';
import { IntermNode } from './intermediateNode';
import { assertNever } from 'booka-common';
import { ValueMatcher } from '../utils';

const classes: ValueMatcher<string> = [
    undefined,
    c => c && c.match(/i\d*$/) ? true : false,
    c => c && c.match(/c\d*$/) ? true : false,
    c => c && c.match(/z\d*$/) ? true : false,
    'pgmonospaced', 'center', 'pgheader', 'fig', 'figleft',
    'indexpageno', 'imageref', 'image', 'chapterhead',
    'right', 'chaptername', 'illus', 'floatright',
];

const expectAttrs: IntermPreprocessor = headParser(node => {
    const diag = diagnoseInterm(node, diagnoseSingle);
    return yieldLast([node], diag);
});

function diagnoseSingle(node: IntermNode): ParserDiagnostic {
    switch (node.interm) {
        case 'text': case 'a': case 'span': case 'quote': case 'ins':
        case 'bold': case 'italic': case 'small': case 'big': case 'sub': case 'sup':
        case 'image':
        case 'pph': case 'header': case 'separator': case 'container':
        case 'table': case 'row': case 'cell':
        case 'list': case 'item':
            return diagnoseIntermAttrs(node, {
                class: classes,
            });
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
