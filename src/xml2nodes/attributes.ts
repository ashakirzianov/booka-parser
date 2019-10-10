import { ParserDiagnostic, compoundDiagnostic } from '../combinators';
import { Semantic } from 'booka-common';
import { Xml2NodesEnv } from './common';
import { XmlTree } from '../xmlStringParser';

type ProcessAttributesResult = {
    diag?: ParserDiagnostic,
};
export function processNodeAttributes(node: XmlTree, env: Xml2NodesEnv): ProcessAttributesResult {
    if (node.type !== 'element') {
        return {};
    }

    const diags: ParserDiagnostic[] = [];
    for (const [attr, value] of Object.entries(node.attributes)) {
        diags.push(diagnoseAttribute(node.name, attr, value));
    }

    return {
        diag: compoundDiagnostic(diags),
    };
}

function diagnoseAttribute(element: string, attr: string, value: string | undefined): ParserDiagnostic {
    switch (attr) {
        case 'class': case 'id': case 'style':
            return undefined;
    }

    switch (element) {
        case 'p': case 'div':
            switch (attr) {
                case 'xml:space':
                    return undefined;
            }
            break;
        case 'table':
            switch (attr) {
                case 'summary':
                case 'border': case 'width':
                case 'cellpadding': case 'cellspacing':
                    return undefined;
            }
            break;
        case 'td':
            switch (attr) {
                case 'colspan': case 'align': case 'valign':
                    return undefined;
            }
            break;
        case 'image': case 'img':
            switch (attr) {
                case 'alt': case 'title': case 'src':
                case 'tag': case 'width':
                    return undefined;
            }
            break;
        case 'a':
            switch (attr) {
                case 'href': case 'title': case 'tag':
                    return undefined;
            }
        case 'ins':
            switch (attr) {
                case 'title': return undefined;
            }
            break;
    }

    return {
        diag: 'unexpected-attr',
        node: element,
        attr, value,
    };
}
