import { flatten } from 'booka-common';
import { StreamParser, some, choice, headParser, yieldLast, translate } from '../combinators';
import { IntermTop } from './intermediateNode';

export type IntermPreprocessor = StreamParser<IntermTop, IntermTop[]>;

export function buildPreprocessor(hook: IntermPreprocessor): IntermPreprocessor {
    const single = choice(hook, headParser(interm => yieldLast([interm])));
    return translate(
        some(single),
        flatten,
    );
}
