import { BookElement, CompoundElement } from './bookElement';

export function flattenElements(rawNodes: BookElement[]): BookElement[] {
    const result: BookElement[] = [];
    for (const node of rawNodes) {
        switch (node.element) {
            case 'compound-raw':
                const preprocessed: CompoundElement = {
                    ...node,
                    nodes: flattenElements(node.nodes),
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

function shouldBeFlatten(container: CompoundElement): boolean {
    return !container.nodes.every(n => n.element === 'span');
}
