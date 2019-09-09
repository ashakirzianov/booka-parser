import { KnownTag } from 'booka-common';
import { EpubConverterHooks, MetadataRecord } from './epubBookParser';
import { ignoreTags, EpubNodeParser, buildRef } from './nodeParser';
import { ParserDiagnoser } from '../log';
import { name, children, nameAttrs, textNode, whitespaces } from '../xmlParser';
import {
    and, translate, seq, maybe, envParser, yieldOne,
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
    metadataHooks: [metaHook],
};

function metaHook({ key, value }: MetadataRecord, ds: ParserDiagnoser): KnownTag[] | undefined {
    switch (key) {
        case 'dc:identifier':
            const id = value['#'];
            if (id && typeof id === 'string') {
                const matches = id.match(/http:\/\/www.gutenberg\.org\/ebooks\/([0-9]*)/);
                if (matches && matches[1]) {
                    const index = parseInt(matches[1], 10);
                    if (index) {
                        return [{ tag: 'pg-index', value: index }];
                    }
                }
            }

            ds.add({ diag: 'bad-meta', meta: { key, value } });
            return [];
        default:
            return undefined;
    }
}

function footnote(): EpubNodeParser {
    return envParser(env => {
        const footnoteId = translate(
            nameAttrs(
                'a',
                {
                    id: i => i
                        ? i.startsWith('link')
                        : false,
                }),
            el => el.attributes.id || null,
        );
        const footnoteMarker = translate(
            and(name('p'), children(footnoteId)),
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
                name('a'),
                textNode(),
                name('br'),
            ),
            ([title]) => title,
        );

        const footnoteContent = seq(maybe(footnoteTitleLine), env.recursive);
        const footnoteP = nameAttrs('p', { class: 'foot' });

        const footnoteContainer = translate(
            and(footnoteP, children(footnoteContent)),
            ([_, [title, content]]) => content,
        );

        const fullFootnote: EpubNodeParser = translate(
            seq(footnoteMarker, whitespaces, footnoteContainer),
            ([id, _, content]) => [{
                node: 'compound-raw',
                ref: buildRef(env.filePath, id),
                nodes: content,
            }],
        );

        return fullFootnote;
    });
}
