import {
    BookNode, flatten, nodeSpans, ListItem, flagSpan,
    success, Success, Diagnostic, compoundDiagnostic, compoundSpan,
} from 'booka-common';
import { XmlElement } from '../xml';
import { Xml2NodesEnv, unexpectedNode, isTrailingWhitespace } from './common';
import { topLevelNodes } from './node';

export function listNode(node: XmlElement, env: Xml2NodesEnv): Success<BookNode[]> {
    const items = listItems(node, env);
    const list: BookNode = {
        node: 'list',
        kind: node.name === 'ol' ? 'ordered'
            : node.name === 'dl' ? 'definitions'
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
            case 'dd': case 'dt':
            case 'li':
                {
                    const content = topLevelNodes(node.children, env);
                    diags.push(content.diagnostic);
                    const spans = flatten(content.value.map(nodeSpans));
                    let span = compoundSpan(spans);
                    span = node.name === 'dd' ? flagSpan(span, 'definition')
                        : node.name === 'dt' ? flagSpan(span, 'term')
                            : span;
                    items.push({
                        span,
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
