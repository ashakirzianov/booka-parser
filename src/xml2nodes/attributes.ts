import {
    NodeFlag, Diagnostic, compoundDiagnostic,
} from 'booka-common';
import { Xml2NodesEnv, AttributesHookResult } from './common';
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
    const results: AttributesHookResult[] = [];
    for (const [attr, value] of Object.entries(node.attributes)) {
        if (env.hooks && env.hooks.attributesHook) {
            const values = value !== undefined
                ? (attr === 'class' ? value.split(' ') : [value])
                : [];
            for (const v of values) {
                const hookResult = env.hooks.attributesHook(node.name, attr, v);
                results.push(hookResult);
                const defaultResult = processAttribute(node.name, attr, v);
                results.push(defaultResult);
            }
        }
    }
    for (const result of results) {
        if (result.flag !== undefined) {
            flags.push(result.flag);
        }
        diags.push(result.diag);
    }

    return {
        diag: compoundDiagnostic(diags),
        flags,
    };
}

function processAttribute(element: string, attr: string, value: string | undefined): AttributesHookResult {
    switch (attr) {
        case 'content': case 'http-equiv':
        case 'title':
        case 'class': case 'id': case 'style':
        case 'xml:space': case 'xml:lang': case 'xmlns':
        case 'clas': // Typo
            return {};
        case 'dir':
            return value === 'rtl'
                ? { flag: 'right-to-left' }
                : {};
    }

    switch (element) {
        case 'div':
            switch (attr) {
                case 'h3': // TODO: what is this ?
                case 'cellpadding': case 'cellspacing':
                    return {};
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
                    return {};
            }
            break;
        case 'td':
            switch (attr) {
                case 'colspan': case 'align': case 'valign':
                    return {};
            }
            break;
        case 'image': case 'img':
            switch (attr) {
                case 'alt': case 'src':
                case 'tag': case 'width':
                    return {};
            }
            break;
        case 'a':
            switch (attr) {
                case 'href': case 'tag':
                    return {};
            }
            break;
        case 'hr':
            switch (attr) {
                case 'width':
                    return {};
            }
            break;
        case 'ol': case 'ul':
            switch (attr) {
                case 'start':
                    return {};
            }
            break;
    }

    return {
        diag: {
            diag: 'unexpected-attr',
            node: element,
            attr, value,
        },
    };
}
