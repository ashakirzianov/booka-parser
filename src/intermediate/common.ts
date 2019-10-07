import { StreamParser } from '../combinators';
import { IntermTop } from './intermediateNode';
import { EpubBook } from '../epub';

type Env = { filePath: string };
export type IntermPreprocessor = StreamParser<IntermTop, IntermTop[], Env>;
export type PreResolver = (epub: EpubBook) => IntermPreprocessor | undefined;
