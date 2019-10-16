import {
    BookNode, flatten, nodeSpans, ListItem,
    success, Success, Diagnostic, compoundDiagnostic, compoundSpan,
} from 'booka-common';
import { XmlElement } from '../xml';
import { Xml2NodesEnv, unexpectedNode, isTrailingWhitespace } from './common';
import { topLevelNodes } from './node';

export function listNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    const items = listItems(node, env);
    const list: BookNode = {
        node: 'list',
        kind: node.name === 'ol'
            ? 'ordered'
            : 'basic',
        items: items.value,
    };
    return success([list], items.diagnostic);
}

function listItems(list: XmlElement, env: Xml2NodesEnv): Success<ListItem[]> {
    const diags: Diagnostic[] = [];
    const items: ListItem[] = [];
    for (const node of list.children) {
        if (isTrailingWhitespace(node)) {
            continue;
        }
        switch (node.name) {
            case 'dd': case 'dt': // TODO: handle properly
            case 'li':
                {
                    const content = topLevelNodes(node.children, env);
                    diags.push(content.diagnostic);
                    const spans = flatten(content.value.map(nodeSpans));
                    items.push({
                        span: compoundSpan(spans),
                    });
                }
                break;
            case 'a':
                if (node.children.length !== 0) {
                    diags.push(unexpectedNode(node, 'list'));
                }
                break;
            default:
                diags.push(unexpectedNode(node, 'list'));
                break;
        }
    }

    return success(items, compoundDiagnostic(diags));
}
