import {
    NodeFlag, Diagnostic, compoundDiagnostic,
} from 'booka-common';
import { Xml2NodesEnv } from './common';
import { Xml } from '../xml';

type ProcessAttributesResult = {
    diag?: Diagnostic,
    flags?: NodeFlag[],
};
export function processNodeAttributes(node: Xml, env: Xml2NodesEnv): ProcessAttributesResult {
    if (node.type !== 'element') {
        return {};
    }

    const diags: Diagnostic[] = [];
    const flags: NodeFlag[] = [];
    for (const [attr, value] of Object.entries(node.attributes)) {
        diags.push(diagnoseAttribute(node.name, attr, value));
        if (env.hooks && env.hooks.attributesHook) {
            const values = value !== undefined
                ? (attr === 'class' ? value.split(' ') : [value])
                : [];
            for (const v of values) {
                const result = env.hooks.attributesHook(node.name, attr, v);
                if (result.flag !== undefined) {
                    flags.push(result.flag);
                }
                diags.push(result.diag);
            }
        }
    }

    return {
        diag: compoundDiagnostic(diags),
        flags,
    };
}

function diagnoseAttribute(element: string, attr: string, value: string | undefined): Diagnostic {
    switch (attr) {
        case 'content': case 'http-equiv':
        case 'title':
        case 'class': case 'id': case 'style':
        case 'xml:space': case 'xml:lang': case 'xmlns':
        case 'clas': // Typo
            return undefined;
        case 'dir': // TODO: what is this ?
            switch (element) {
                case 'div': case 'p': case 'span':
                case 'table': case 'h3':
                    return undefined;
            }
            break;
    }

    switch (element) {
        case 'div':
            switch (attr) {
                case 'h3': // TODO: what is this ?
                case 'cellpadding': case 'cellspacing':
                    return undefined;
            }
            break;
        case 'table':
            switch (attr) {
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
                case 'alt': case 'src':
                case 'tag': case 'width':
                    return undefined;
            }
            break;
        case 'a':
            switch (attr) {
                case 'href': case 'tag':
                    return undefined;
            }
            break;
        case 'hr':
            switch (attr) {
                case 'width':
                    return undefined;
            }
            break;
        case 'ol': case 'ul':
            switch (attr) {
                case 'start':
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
