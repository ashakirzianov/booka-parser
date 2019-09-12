import { BookElement, CompoundElement } from './bookElement';

export function flattenElements(rawNodes: BookElement[]): BookElement[] {
    const result: BookElement[] = [];
    for (const node of rawNodes) {
        switch (node.element) {
            case 'compound':
                const preprocessed: CompoundElement = {
                    ...node,
                    elements: flattenElements(node.elements),
                };
                if (shouldBeFlatten(preprocessed)) {
                    result.push(...preprocessed.elements);
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
    return !container.elements.every(n => n.element === 'span');
}
