import { RawBookNode, RawCompoundNode } from 'booka-common';

export function flattenNodes(rawNodes: RawBookNode[]): RawBookNode[] {
    const result: RawBookNode[] = [];
    for (const node of rawNodes) {
        switch (node.node) {
            case 'compound-raw':
                const preprocessed: RawCompoundNode = {
                    ...node,
                    nodes: flattenNodes(node.nodes),
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

function shouldBeFlatten(container: RawCompoundNode): boolean {
    return !container.nodes.every(n => n.node === 'span');
}
