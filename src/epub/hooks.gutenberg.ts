import { EpubConverterHooks, MetadataRecordParser, EpubNodeParser } from './epubBookParser';
import { ignoreTags, buildRef } from './sectionParser.utils';
import { xmlName, xmlNameAttrs, xmlChildren, textNode, whitespaces } from '../xmlParser';
import {
    and, translate, seq, maybe, envParser, headParser, reject, yieldLast,
} from '../combinators';

export const gutenbergHooks: EpubConverterHooks = {
    nodeHooks: [
        // TODO: do not ignore?
        ignoreTags([
            'hr', 'blockquote', 'table',
            'ins',
            'ol', 'ul',
        ]),
        footnote(),
    ],
    metadataHooks: [metaHook()],
};

function metaHook(): MetadataRecordParser {
    return headParser(([key, value]) => {
        switch (key) {
            case 'dc:identifier':
                const id = value['#'];
                if (id && typeof id === 'string') {
                    const matches = id.match(/http:\/\/www.gutenberg\.org\/ebooks\/([0-9]*)/);
                    if (matches && matches[1]) {
                        const index = parseInt(matches[1], 10);
                        if (index) {
                            return yieldLast([{ tag: 'pg-index', value: index }]);
                        }
                    }
                }

                return yieldLast([], { diag: 'bad-meta', meta: { key, value } });
            default:
                return reject();
        }
    });
}

function footnote(): EpubNodeParser {
    return envParser(env => {
        const footnoteId = translate(
            xmlNameAttrs(
                'a',
                {
                    id: i => i
                        ? i.startsWith('link')
                        : false,
                }),
            el => el.attributes.id || null,
        );
        const footnoteMarker = translate(
            and(xmlName('p'), xmlChildren(footnoteId)),
            ([_, id]) => id,
        );

        const footnoteTitle = textNode(t => {
            if (t.endsWith('(')) {
                t = t.substr(0, t.length - 1);
            }

            return t.trim();
        });

        const footnoteTitleLine = translate(
            seq(
                footnoteTitle,
                xmlName('a'),
                textNode(),
                xmlName('br'),
            ),
            ([title]) => title,
        );

        const footnoteContent = seq(maybe(footnoteTitleLine), env.recursive);
        const footnoteP = xmlNameAttrs('p', { class: 'foot' });

        const footnoteContainer = translate(
            and(footnoteP, xmlChildren(footnoteContent)),
            ([_, [title, content]]) => ({ title, content }),
        );

        const fullFootnote: EpubNodeParser = translate(
            seq(footnoteMarker, whitespaces, footnoteContainer),
            ([id, _, { content, title }]) => [{
                node: 'compound-raw',
                ref: buildRef(env.filePath, id),
                nodes: content,
                semantic: 'footnote',
                title: title ? [title] : [],
            }],
        );

        return fullFootnote;
    });
}
