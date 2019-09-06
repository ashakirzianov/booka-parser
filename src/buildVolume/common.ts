import { assignAttributes, RawBookNode, Span } from 'booka-common';
import { filterUndefined, assertNever } from '../utils';
import { ParserDiagnoser } from '../log';

export function spanFromRawNode(rawNode: RawBookNode, ds: ParserDiagnoser): Span | undefined {
    switch (rawNode.node) {
        case 'span':
            return rawNode.span;
        case 'attr':
            const attrSpan = spanFromRawNode(rawNode.content, ds);
            if (attrSpan !== undefined) {
                return assignAttributes(...rawNode.attributes)(attrSpan);
            } else {
                ds.add({ diag: 'couldnt-build-span', node: rawNode, context: 'attr' });
                return undefined;
            }
        case 'container':
            const spans = filterUndefined(rawNode.nodes.map(c => spanFromRawNode(c, ds)));
            return {
                span: 'compound',
                spans: spans,
            };
        case 'ignore':
            return undefined;
        case 'image-data':
        case 'image-ref':
        case 'image-url':
        case 'title':
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
