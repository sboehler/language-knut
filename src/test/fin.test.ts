import * as assert from 'assert';

import { parseFinErrors } from '../fin';

// Verbatim output of the fin this was written against, so that a change to the
// shape of its errors fails here rather than silently stopping the checks.
const SYNTAX_ERROR = `syntax error: expected 'e'

In file "/journal/bad.fin"
Line 2, column 14:

    2 |2025-01-02 opne Assets:Foo
                    ^ want 'e'

  while parsing an 'open' directive, from line 2, column 1
  while parsing a directive, from line 2, column 1

`;

const UNOPENED_ACCOUNT = `Error: transaction directive on 2025-01-02: account Expenses:NotOpened is not open.

Defined in file "/journal/sem.fin", line 3, column 1

    3 |2025-01-02 "x"
    4 |Assets:Bank Expenses:NotOpened 5 CHF

`;

const FAILED_ASSERTION = `Error: balance directive on 2025-01-03: account Assets:Bank has balance 5 CHF, want 99 CHF.

Defined in file "/journal/assert.fin", line 7, column 20

    7 |2025-01-03 balance Assets:Bank 99 CHF

`;

const UNREADABLE = `error reading file: /journal/root.fin:
No such file or directory (os error 2)
`;

suite('parseFinErrors', () => {

    test('reads a syntax error, with the production it was found in', () => {
        const [error] = parseFinErrors(SYNTAX_ERROR);
        assert.strictEqual(error.file, '/journal/bad.fin');
        assert.strictEqual(error.line, 2);
        assert.strictEqual(error.column, 14);
        assert.strictEqual(error.message, "syntax error: expected 'e' (while parsing an 'open' directive)");
    });

    test('reads an account that is not open', () => {
        const [error] = parseFinErrors(UNOPENED_ACCOUNT);
        assert.strictEqual(error.file, '/journal/sem.fin');
        assert.strictEqual(error.line, 3);
        assert.strictEqual(error.column, 1);
        assert.strictEqual(
            error.message,
            'transaction directive on 2025-01-02: account Expenses:NotOpened is not open.');
    });

    test('reads a balance assertion that does not hold', () => {
        const [error] = parseFinErrors(FAILED_ASSERTION);
        assert.strictEqual(error.file, '/journal/assert.fin');
        assert.strictEqual(error.line, 7);
        assert.strictEqual(error.column, 20);
        assert.ok(error.message.includes('has balance 5 CHF, want 99 CHF'));
    });

    test('reads a file it could not open, which has no position', () => {
        const [error] = parseFinErrors(UNREADABLE);
        assert.strictEqual(error.file, '/journal/root.fin');
        assert.strictEqual(error.line, undefined);
        assert.strictEqual(error.message, 'No such file or directory (os error 2): /journal/root.fin');
    });

    test('keeps a shape it does not know rather than dropping it', () => {
        const [error] = parseFinErrors('something new went wrong\nwith detail\n');
        assert.strictEqual(error.message, 'something new went wrong');
        assert.strictEqual(error.file, undefined);
    });

    test('finds nothing in no output', () => {
        assert.deepStrictEqual(parseFinErrors('   \n'), []);
    });
});
