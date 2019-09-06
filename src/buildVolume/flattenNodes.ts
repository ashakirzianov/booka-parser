import { RawBookNode, RawContainerNode } from 'booka-common';
import { ParserDiagnoser } from '../log';

export function flattenNodes(rawNodes: RawBookNode[], ds: ParserDiagnoser): RawBookNode[] {
    const result: RawBookNode[] = [];
    for (const node of rawNodes) {
        switch (node.node) {
            case 'container':
                const preprocessed: RawContainerNode = {
                    ...node,
                    nodes: flattenNodes(node.nodes, ds),
                };
                if (shouldBeFlatten(preprocessed)) {
                    result.push(...preprocessed.nodes);
                } else {
                    result.push(preprocessed);
                }
                break;
            case 'tag':
            case 'ignore':
                break;
            default:
                result.push(node);
                break;
        }
    }

    return result;
}

function shouldBeFlatten(container: RawContainerNode): boolean {
    return !container.nodes.some(n => (n.node === 'span') || n.node === 'attr');
}
