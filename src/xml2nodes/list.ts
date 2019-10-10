import {
    BookContentNode, flatten, Span, extractSpans, ListItem,
} from 'booka-common';
import { XmlTreeElement, XmlTree } from '../xmlStringParser';
import {
    yieldLast, SuccessLast,
} from '../combinators';
import { Env, unexpectedNode, processNodes } from './base';
import { topLevelNodes } from './node';

export function listNode(node: XmlTreeElement, env: Env): SuccessLast<BookContentNode> {
    const listData = listItems(node.children, env);
    const items: ListItem[] = listData.value.map(i => ({
        spans: i,
    }));
    const list: BookContentNode = {
        node: 'list',
        kind: node.name === 'ol'
            ? 'ordered'
            : 'basic',
        items,
    };
    return yieldLast(list, listData.diagnostic);
}

type ListItemData = Span[];
function listItems(nodes: XmlTree[], env: Env): SuccessLast<ListItemData[]> {
    return processNodes(nodes, env, node => {
        switch (node.name) {
            case 'li':
                {
                    const content = topLevelNodes(node.children, env);
                    const spans = flatten(content.value.map(extractSpans));
                    return {
                        values: [spans],
                        diag: content.diagnostic,
                    };
                }
            default:
                return { diag: unexpectedNode(node, 'list') };
        }
    });
}
