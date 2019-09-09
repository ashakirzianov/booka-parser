import { expectSuccess } from '../utils';
import { path } from './treeParser';
import { name } from './elementParser';
import { xmlElement } from './xmlTree';
import { makeStream } from '../combinators';

it('pathParser', () => {
    const nodes = [xmlElement('root', [
        xmlElement('a'),
        xmlElement('b'),
        xmlElement('c', [
            xmlElement('ca'),
            xmlElement('cb', [
                xmlElement('cba'),
            ]),
        ]),
    ])];
    const input = makeStream(nodes);

    const parser = path(['root', 'c', 'cb', 'cba'], name('cba'));

    const result = parser(input);

    expectSuccess(result);
});
