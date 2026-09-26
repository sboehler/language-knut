import * as assert from 'assert';

import { findIncludes } from '../links';

suite('findIncludes', () => {

    test('finds the path, without the quotes around it', () => {
        const [include] = findIncludes('include "prices/2025.fin"\n');
        assert.strictEqual(include.path, 'prices/2025.fin');
        assert.strictEqual(include.line, 0);
        assert.strictEqual(include.start, 9);
        assert.strictEqual(include.end, 24);
    });

    test('finds every directive, on the line it is on', () => {
        const includes = findIncludes([
            '# a comment',
            'include "a.fin"',
            '',
            'include "sub/b.fin"',
        ].join('\n'));
        assert.deepStrictEqual(includes.map(i => [i.line, i.path]), [[1, 'a.fin'], [3, 'sub/b.fin']]);
    });

    test('ignores what fin would not read as an include', () => {
        assert.deepStrictEqual(findIncludes([
            '  include "indented.fin"',   // directives sit at column zero
            '# include "commented.fin"',
            'include "unterminated.fin',
            'include ""',                 // the empty path names no file
            'included "elsewhere.fin"',
        ].join('\n')), []);
    });
});
