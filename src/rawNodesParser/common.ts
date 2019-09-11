import { assignAttributes, RawBookNode, Span } from 'booka-common';
import { filterUndefined, assertNever } from '../utils';
import { ResultLast, yieldLast, compoundDiagnostic, reject } from '../combinators';

export function spanFromRawNode(
    rawNode: RawBookNode,
    titles?: string[], // TODO: find better solution
): ResultLast<Span> {
    switch (rawNode.node) {
        case 'span':
            return yieldLast(rawNode.span);
        case 'attr':
            const attrSpan = spanFromRawNode(rawNode.content, titles);
            if (attrSpan.success) {
                return yieldLast(
                    assignAttributes(...rawNode.attributes)(attrSpan.value),
                    attrSpan.diagnostic,
                );
            } else {
                return reject({ diag: 'couldnt-build-span', node: rawNode, context: 'attr' });
            }
        case 'compound-raw':
            const insideResults = rawNode.nodes
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
        case 'ref':
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
        default:
            assertNever(rawNode);
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
    }
}
