import { ParserDiagnostic, compoundDiagnostic } from '../combinators';
import { Semantic, flagSemantic } from 'booka-common';
import { Xml2NodesEnv } from './common';
import { Xml } from '../xml';

type ProcessAttributesResult = {
    diag?: ParserDiagnostic,
    semantics?: Semantic[],
};
export function processNodeAttributes(node: Xml, env: Xml2NodesEnv): ProcessAttributesResult {
    if (node.type !== 'element') {
        return {};
    }

    const diags: ParserDiagnostic[] = [];
    const semantics: Semantic[] = [];
    for (const [attr, value] of Object.entries(node.attributes)) {
        diags.push(diagnoseAttribute(node.name, attr, value));
        if (env.hooks && env.hooks.attributesHook) {
            const values = value !== undefined
                ? (attr === 'class' ? value.split(' ') : [value])
                : [];
            for (const v of values) {
                const result = env.hooks.attributesHook(node.name, attr, v);
                if (result.flag !== undefined) {
                    semantics.push(flagSemantic(result.flag));
                }
                if (result.semantics !== undefined) {
                    semantics.push(...result.semantics);
                }
                diags.push(result.diag);
            }
        }
    }

    return {
        diag: compoundDiagnostic(diags),
        semantics,
    };
}

function diagnoseAttribute(element: string, attr: string, value: string | undefined): ParserDiagnostic {
    switch (attr) {
        case 'class': case 'id': case 'style':
            return undefined;
    }

    switch (element) {
        case 'blockquote':
        case 'span':
            switch (attr) {
                // TODO: process ?
                case 'xml:lang':
                case 'title': return undefined;
            }
            break;
        case 'p': case 'div':
            switch (attr) {
                // TODO: process ?
                case 'title': return undefined;
                // TODO: assign semantics ?
                case 'xml:space':
                case 'xml:lang':
                case 'xmlns':
                case 'clas':
                    return undefined;
            }
            break;
        case 'h1': case 'h2': case 'h3':
        case 'h4': case 'h5': case 'h6':
            switch (attr) {
                case 'xml:lang':
                    return undefined;
            }
            break;
        case 'table':
            switch (attr) {
                case 'title':
                case 'dir':
                case 'frame':
                case 'rules':
                case 'summary':
                case 'border': case 'bordercolor':
                case 'height': case 'width':
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
        case 'hr':
            switch (attr) {
                case 'title': case 'width':
                    return undefined;
            }
            break;
        case 'ol': case 'ul':
            switch (attr) {
                case 'xml:lang':
                case 'start': // TODO: handle ?
                    return undefined;
            }
            break;
    }

    return {
        diag: 'unexpected-attr',
        node: element,
        attr, value,
    };
}
