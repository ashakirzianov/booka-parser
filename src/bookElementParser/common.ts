import { Span } from 'booka-common';
import { assertNever } from '../utils';
import { ResultLast, reject } from '../combinators';
import { BookElement } from './bookElement';

export function spanFromRawNode(
    rawNode: BookElement,
    titles?: string[], // TODO: find better solution
): ResultLast<Span> {
    switch (rawNode.element) {
        case 'ignore':
            return reject();
        case 'chapter-title':
            if (titles) {
                titles.push(...rawNode.title);
                return reject();
            } else {
                return reject({ diag: 'unexpected-title', node: rawNode, context: 'span' });
            }
        case 'image-ref':
        case 'tag':
        case 'content':
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
        default:
            assertNever(rawNode);
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'span' });
    }
}
