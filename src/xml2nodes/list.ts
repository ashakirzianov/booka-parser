import {
    BookNode, flatten, Span, extractSpans, ListItem,
    success, Success,
} from 'booka-common';
import { XmlElement, Xml } from '../xml';
import { Xml2NodesEnv, unexpectedNode, processNodes } from './common';
import { topLevelNodes } from './node';
import { isWhitespaces } from '../utils';

export function listNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode> {
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
    return success(list, listData.diagnostic);
}

type ListItemData = Span[];
function listItems(nodes: Xml[], env: Xml2NodesEnv): Success<ListItemData[]> {
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
            case 'a':
                return node.children.length === 0
                    ? {}
                    : { diag: unexpectedNode(node, 'list') };
            case undefined:
                return node.type === 'text' && isWhitespaces(node.text)
                    ? {}
                    : { diag: unexpectedNode(node, 'list') };
            default:
                return { diag: unexpectedNode(node, 'list') };
        }
    });
}
