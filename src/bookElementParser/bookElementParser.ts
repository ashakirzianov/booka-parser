import {
    BookContentNode, ChapterNode, VolumeNode, VolumeMeta,
} from 'booka-common';
import {
    AsyncStreamParser, yieldLast, ParserDiagnostic,
    compoundDiagnostic, ResultLast, SuccessLast, reject,
} from '../combinators';
import { BookElement, TitleOrContentElement } from './bookElement';

export type ElementParser = AsyncStreamParser<BookElement, VolumeNode>;

export const elementParser: ElementParser = async ({ stream }) => {
    const diags: ParserDiagnostic[] = [];
    const result = parseMeta(stream);
    diags.push(result.diagnostic);
    const nodes = buildChapters(result.value.titleOrContent);
    diags.push(nodes.diagnostic);

    const volume: VolumeNode = {
        node: 'volume',
        nodes: nodes.value,
        meta: result.value.meta,
    };

    return yieldLast(volume, compoundDiagnostic(diags));
};

function parseMeta(elements: BookElement[]) {
    const meta: VolumeMeta = {};
    const titleOrContent: TitleOrContentElement[] = [];
    const diags: ParserDiagnostic[] = [];
    for (const el of elements) {
        switch (el.element) {
            case 'tag':
                const tag = el.tag;
                switch (tag.tag) {
                    case 'title':
                        meta.title = tag.value;
                        break;
                    case 'author':
                        meta.author = tag.value;
                        break;
                    case 'cover-ref':
                        meta.coverImageNode = {
                            node: 'image-ref',
                            imageId: tag.value,
                            imageRef: tag.value,
                        };
                        break;
                }
                break;
            case 'chapter-title':
            case 'content':
                titleOrContent.push(el);
                break;
            default:
                break;
        }
    }

    if (meta.title === undefined) {
        diags.push({ diag: 'empty-book-title' });
    }

    return yieldLast({
        meta, titleOrContent,
    }, compoundDiagnostic(diags));
}

function buildChapters(elements: BookElement[]): SuccessLast<BookContentNode[]> {
    const { nodes, next, diag } = buildChaptersImpl(elements, undefined);

    const tailDiag = next.length !== 0
        ? { diag: 'extra-nodes-tail', nodes: elements }
        : undefined;

    return yieldLast(nodes, compoundDiagnostic([diag, tailDiag]));
}

type BuildChaptersResult = {
    nodes: BookContentNode[],
    next: BookElement[],
    diag: ParserDiagnostic,
};
function buildChaptersImpl(elements: BookElement[], level: number | undefined): BuildChaptersResult {
    if (elements.length === 0) {
        return { nodes: [], next: [], diag: undefined };
    }
    const headNode = elements[0];
    if (headNode.element === 'chapter-title') {
        if (level === undefined || level > headNode.level) {
            const content = buildChaptersImpl(elements.slice(1), headNode.level);
            const chapter: ChapterNode = {
                node: 'chapter',
                nodes: content.nodes,
                title: headNode.title,
                level: headNode.level,
            };
            const after = buildChaptersImpl(content.next, level);
            return {
                nodes: [chapter as BookContentNode].concat(after.nodes),
                next: after.next,
                diag: after.diag,
            };
        } else {
            return {
                nodes: [],
                next: elements,
                diag: undefined,
            };
        }
    } else {
        const node = resolveRawNode(headNode);
        const after = buildChaptersImpl(elements.slice(1), level);
        return {
            nodes: node.success
                ? [node.value, ...after.nodes]
                : after.nodes,
            next: after.next,
            diag: compoundDiagnostic([after.diag, node.diagnostic]),
        };
    }
}

// TODO: propagate diags
function resolveRawNode(rawNode: BookElement): ResultLast<BookContentNode> {
    switch (rawNode.element) {
        default:
            return reject({ diag: 'unexpected-raw-node', node: rawNode, context: 'node' });
    }
}
