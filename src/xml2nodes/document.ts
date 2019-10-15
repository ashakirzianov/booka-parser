import { BookNode } from 'booka-common';
import { XmlDocument, xml2string } from '../xml';
import { success, Success } from '../combinators';
import { Xml2NodesEnv } from './common';
import { topLevelNodes } from './node';

export function documentParser(document: XmlDocument, env: Xml2NodesEnv): Success<BookNode[]> {
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        return success([], {
            diag: 'no-html',
            xml: xml2string(document),
        });
    }
    const body = html.children
        .find(n => n.name === 'body');
    if (body === undefined || body.type !== 'element') {
        return success([], {
            diag: 'no-body',
            xml: xml2string(html),
        });
    }

    return topLevelNodes(body.children, env);
}
