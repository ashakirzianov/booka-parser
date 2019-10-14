import {
    BookNode, flatten, Span, extractSpans, ListItem,
} from 'booka-common';
import { XmlElement, Xml } from '../xml';
import {
    yieldLast, SuccessLast,
} from '../combinators';
import { Xml2NodesEnv, unexpectedNode, processNodes } from './common';
import { topLevelNodes } from './node';
import { isWhitespaces } from '../utils';

export function listNode(node: XmlElement, env: Xml2NodesEnv): SuccessLast<BookNode> {
    // TODO: handle 'start' attribute
    const listData = listItems(node.children, env);
    const items: ListItem[] = listData.value.map(i => ({
        spans: i,
    }));
    const list: BookNode = {
        node: 'list',
        kind: node.name === 'ol'
            ? 'ordered'
            : 'basic',
        items,
    };
    return yieldLast(list, listData.diagnostic);
}

type ListItemData = Span[];
function listItems(nodes: Xml[], env: Xml2NodesEnv): SuccessLast<ListItemData[]> {
    return processNodes(nodes, env, node => {
        switch (node.name) {
            case 'dd': case 'dt': // TODO: handle properly
            case 'li':
                {
                    const content = topLevelNodes(node.children, env);
                    const spans = flatten(content.value.map(extractSpans));
                    return {
                        values: [spans],
                        diag: content.diagnostic,
                    };
                }
            case undefined:
                return node.type === 'text' && isWhitespaces(node.text)
                    ? {}
                    : { diag: unexpectedNode(node, 'list') };
            default:
                return { diag: unexpectedNode(node, 'list') };
        }
    });
}
