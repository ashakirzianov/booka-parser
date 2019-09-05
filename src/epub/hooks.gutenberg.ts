import { KnownTag } from 'booka-common';
import { EpubConverterHooks, MetadataRecord } from './epubConverter.types';
import { ignoreTags } from './nodeHandler';
import { ParserDiagnoser } from '../log';

export const gutenbergHooks: EpubConverterHooks = {
    nodeHooks: [
        // TODO: do not ignore?
        ignoreTags([
            'hr', 'blockquote', 'table',
            'br', 'big', 'small', 'ins',
            'ol',
        ]),
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
