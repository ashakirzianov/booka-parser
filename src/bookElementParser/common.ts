import { Span } from 'booka-common';
import { filterUndefined, assertNever } from '../utils';
import { ResultLast, yieldLast, compoundDiagnostic, reject } from '../combinators';
import { BookElement } from './bookElement';

export function spanFromRawNode(
    rawNode: BookElement,
    titles?: string[], // TODO: find better solution
): ResultLast<Span> {
    switch (rawNode.element) {
        case 'span':
            return yieldLast(rawNode.span);
        case 'compound':
            const insideResults = rawNode.elements
                .map(c => spanFromRawNode(c, titles));
            const spans = filterUndefined(
                insideResults
                    .map(r => r.success ? r.value : undefined)
            );
            return yieldLast({
                span: 'compound',
                spans: spans,
            },
                compoundDiagnostic(insideResults.map(r => r.diagnostic)),
            );
        case 'ignore':
            return reject();
        case 'chapter-title':
            if (titles) {
                titles.push(...rawNode.title);
                return reject();
            } else {
                return reject({ diag: 'unexpected-title', node: rawNode, context: 'span' });
            }
        case 'image-data':
        case 'image-ref':
        case 'image-url':
        case 'tag':
        case 'content':
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
        default:
            assertNever(rawNode);
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
    }
}
