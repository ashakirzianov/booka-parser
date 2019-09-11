import { assignAttributes, RawBookNode, Span } from 'booka-common';
import { filterUndefined, assertNever } from '../utils';
import { ResultLast, yieldOne, compoundDiagnostic, reject } from '../combinators';

export function spanFromRawNode(
    rawNode: RawBookNode,
    titles?: string[], // TODO: find better solution
): ResultLast<Span> {
    switch (rawNode.node) {
        case 'span':
            return yieldOne(rawNode.span);
        case 'attr':
            const attrSpan = spanFromRawNode(rawNode.content, titles);
            if (attrSpan.success) {
                return yieldOne(
                    assignAttributes(...rawNode.attributes)(attrSpan.value),
                    undefined,
                    attrSpan.diagnostic,
                );
            } else {
                return reject({ custom: 'couldnt-build-span', node: rawNode, context: 'attr' });
            }
        case 'compound-raw':
            const insideResults = rawNode.nodes
                .map(c => spanFromRawNode(c, titles));
            const spans = filterUndefined(
                insideResults
                    .map(r => r.success ? r.value : undefined)
            );
            return yieldOne({
                span: 'compound',
                spans: spans,
            },
                undefined,
                compoundDiagnostic(insideResults.map(r => r.diagnostic)),
            );
        case 'ignore':
            return reject();
        case 'chapter-title':
            if (titles) {
                titles.push(...rawNode.title);
                return reject();
            } else {
                return reject({ custom: 'unexpected-title', node: rawNode, context: 'span' });
            }
        case 'image-data':
        case 'image-ref':
        case 'image-url':
        case 'tag':
        case 'ref':
            return reject({ custom: 'unexpected-raw-node', node: rawNode, context: 'span' });
        default:
            assertNever(rawNode);
            return reject({ custom: 'unexpected-raw-node', node: rawNode, context: 'span' });
    }
}
