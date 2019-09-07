import { KnownTag } from 'booka-common';
import { EpubConverterHooks, MetadataRecord } from './epubConverter.types';
import { ignoreTags, EpubNodeParser, buildRef } from './nodeParser';
import { ParserDiagnoser } from '../log';
import { name, and, children, nameAttrs, translate, textNode, seq, maybe, envParser } from '../xml';

export const gutenbergHooks: EpubConverterHooks = {
    nodeHooks: [
        // TODO: do not ignore?
        ignoreTags([
            'hr', 'blockquote', 'table',
            'br', 'big', 'small', 'ins',
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
            nameAttrs('a', { id: i => i ? i.startsWith('linknote-') : false }),
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
            seq(footnoteP, children(footnoteContent)),
            ([_, [title, content]]) => content,
        );

        const fullFootnote: EpubNodeParser = translate(
            seq(footnoteMarker, footnoteContainer),
            ([id, content]) => [{
                node: 'container',
                ref: buildRef(env.filePath, id),
                nodes: content,
            }],
        );

        return fullFootnote;
    });
}
