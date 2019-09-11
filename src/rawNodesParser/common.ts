import { assignAttributes, RawBookNode, Span } from 'booka-common';
import { filterUndefined, assertNever } from '../utils';
import { ResultValue, successValue, compoundDiagnostic, fail } from '../combinators';

export function spanFromRawNode(
    rawNode: RawBookNode,
    titles?: string[], // TODO: find better solution
): ResultValue<Span> {
    switch (rawNode.node) {
        case 'span':
            return successValue(rawNode.span);
        case 'attr':
            const attrSpan = spanFromRawNode(rawNode.content, titles);
            if (attrSpan.success) {
                return successValue(assignAttributes(...rawNode.attributes)(attrSpan.value), attrSpan.diagnostic);
            } else {
                return fail({ custom: 'couldnt-build-span', node: rawNode, context: 'attr' });
            }
        case 'compound-raw':
            const insideResults = rawNode.nodes
                .map(c => spanFromRawNode(c, titles));
            const spans = filterUndefined(
                insideResults
                    .map(r => r.success ? r.value : undefined)
            );
            return successValue({
                span: 'compound',
                spans: spans,
            }, compoundDiagnostic(insideResults.map(r => r.diagnostic)));
        case 'ignore':
            return fail();
        case 'chapter-title':
            if (titles) {
                titles.push(...rawNode.title);
                return fail();
            } else {
                return fail({ custom: 'unexpected-title', node: rawNode, context: 'span' });
            }
        case 'image-data':
        case 'image-ref':
        case 'image-url':
        case 'tag':
        case 'ref':
            return fail({ custom: 'unexpected-raw-node', node: rawNode, context: 'span' });
        default:
            assertNever(rawNode);
            return fail({ custom: 'unexpected-raw-node', node: rawNode, context: 'span' });
    }
}
