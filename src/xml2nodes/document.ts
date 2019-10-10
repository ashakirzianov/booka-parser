import { BookContentNode } from 'booka-common';
import { XmlDocument, xml2string } from '../xml';
import { yieldLast, SuccessLast } from '../combinators';
import { Xml2NodesEnv } from './common';
import { topLevelNodes } from './node';

export function documentParser(document: XmlDocument, env: Xml2NodesEnv): SuccessLast<BookContentNode[]> {
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        return yieldLast([], {
            diag: 'no-html',
            xml: xml2string(document),
        });
    }
    const body = html.children
        .find(n => n.name === 'body');
    if (body === undefined || body.type !== 'element') {
        return yieldLast([], {
            diag: 'no-body',
            xml: xml2string(html),
        });
    }

    return topLevelNodes(body.children, env);
}
