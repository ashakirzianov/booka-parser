import { BookContentNode } from 'booka-common';
import { XmlTreeDocument, tree2String } from '../xmlStringParser';
import { yieldLast, SuccessLast } from '../combinators';
import { Xml2NodesEnv } from './common';
import { topLevelNodes } from './node';

export function documentParser(document: XmlTreeDocument, env: Xml2NodesEnv): SuccessLast<BookContentNode[]> {
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        return yieldLast([], {
            diag: 'no-html',
            xml: tree2String(document),
        });
    }
    const body = html.children
        .find(n => n.name === 'body');
    if (body === undefined || body.type !== 'element') {
        return yieldLast([], {
            diag: 'no-body',
            xml: tree2String(html),
        });
    }

    return topLevelNodes(body.children, env);
}
