import { assignAttributes, RawBookNode, Span } from 'booka-common';
import { filterUndefined, assertNever } from '../utils';
import { ParserDiagnoser } from '../log';

export function spanFromRawNode(
    rawNode: RawBookNode,
    ds: ParserDiagnoser,
    titles?: string[], // TODO: find better solution
): Span | undefined {
    switch (rawNode.node) {
        case 'span':
            return rawNode.span;
        case 'attr':
            const attrSpan = spanFromRawNode(rawNode.content, ds, titles);
            if (attrSpan !== undefined) {
                return assignAttributes(...rawNode.attributes)(attrSpan);
            } else {
                ds.add({ diag: 'couldnt-build-span', node: rawNode, context: 'attr' });
                return undefined;
            }
        case 'compound-raw':
            const spans = filterUndefined(rawNode.nodes.map(c => spanFromRawNode(c, ds, titles)));
            return {
                span: 'compound',
                spans: spans,
            };
        case 'ignore':
            return undefined;
        case 'title':
            if (titles) {
                titles.push(...rawNode.title);
            } else {
                ds.add({ diag: 'unexpected-title', node: rawNode, context: 'span' });
            }
            return undefined;
        case 'image-data':
        case 'image-ref':
        case 'image-url':
        case 'tag':
        case 'ref':
            ds.add({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
            return undefined;
        default:
            ds.add({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
            assertNever(rawNode);
            return undefined;
    }
}
