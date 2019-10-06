import { flatten } from 'booka-common';
import { StreamParser, some, choice, headParser, yieldLast, translate } from '../combinators';
import { IntermediateNode } from './intermediateNode';

export type IntermPreprocessor = StreamParser<IntermediateNode, IntermediateNode[]>;

export function buildPreprocessor(hook: IntermPreprocessor): IntermPreprocessor {
    const single = choice(hook, headParser(interm => yieldLast(interm)));
    return translate(
        some(single),
        flatten,
    );
}
