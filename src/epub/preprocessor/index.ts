import { images } from './images';
import { references } from './references';
import { BookPreprocessor, preprocessWithProcessors, PreprocessorArgs } from './preprocessor';
import { consistency } from './consistency';
import { normalize } from './normalize';

export function preprocess(args: PreprocessorArgs) {
    const preprocessors: BookPreprocessor[] = [
        images,
        references,
        consistency,
        normalize,
    ];

    return preprocessWithProcessors(args, preprocessors);
}
