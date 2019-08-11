import { expectSuccess } from '../utils';
import { and } from './parserCombinators';
import { skipTo, ArrayParser, headParser } from './arrayParser';

function str(s: string): ArrayParser<string, string> {
    return headParser<string>()(h => h === s ? h : null);
}
it('skipTo', () => {
    const input = [
        'a', 'b', 'c', 'b',
    ];

    const parser = skipTo(and(str('c'), str('c')));

    const result = parser(input);
    expect(result.success).toBeTruthy();
    if (expectSuccess(result)) {
        expect(result.value[1]).toBe('c');
    }

});
