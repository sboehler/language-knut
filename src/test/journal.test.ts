import * as assert from 'assert';

import { findDeclarations } from '../journal';

suite('findDeclarations', () => {

    test('finds an open, and where the account it names sits', () => {
        const [declaration] = findDeclarations('2025-01-01 open Assets:Bank:Checking\n');
        assert.strictEqual(declaration.kind, 'open');
        assert.strictEqual(declaration.account, 'Assets:Bank:Checking');
        assert.strictEqual(declaration.date, '2025-01-01');
        assert.strictEqual(declaration.line, 0);
        assert.strictEqual(declaration.start, 16);
        assert.strictEqual(declaration.end, 36);
    });

    test('finds a close', () => {
        const [declaration] = findDeclarations('2025-12-31 close Expenses:Food:Restaurants\n');
        assert.strictEqual(declaration.kind, 'close');
        assert.strictEqual(declaration.account, 'Expenses:Food:Restaurants');
        assert.strictEqual(declaration.date, '2025-12-31');
    });

    test('finds every directive, on the line it is on', () => {
        const declarations = findDeclarations([
            '# a comment',
            '2025-01-01 open Assets:Bank',
            '',
            '2025-01-25 "Salary"',
            'Income:Salary Assets:Bank 5000.00 CHF',
            '2025-06-30 close Assets:Bank',
        ].join('\n'));
        assert.deepStrictEqual(
            declarations.map(d => [d.line, d.kind, d.account]),
            [[1, 'open', 'Assets:Bank'], [5, 'close', 'Assets:Bank']]);
    });

    test('takes the account alone, not what follows it', () => {
        const [declaration] = findDeclarations('2025-01-01 open Assets:Bank # opened late\n');
        assert.strictEqual(declaration.account, 'Assets:Bank');
        assert.strictEqual(declaration.end, 27);
    });

    test('reads a segment fin would read, letters and digits alike', () => {
        assert.deepStrictEqual(
            findDeclarations('2025-04-01 open Assets:Bänk:Konto2\n').map(d => d.account),
            ['Assets:Bänk:Konto2']);
    });

    test('ignores what fin would not read as a declaration', () => {
        assert.deepStrictEqual(findDeclarations([
            '  2025-01-01 open Assets:Indented',   // directives sit at column zero
            '# 2025-01-01 open Assets:Commented',
            '2025-01-01 opne Assets:Typo',
            '2025-01-01 opens Assets:Bank',
            '2025-01-01 open Savings:Bank',        // not one of the five types
            '2025-01-01 open Incomexyz',           // nor is the type a prefix of one
            '2025-01-01 open',
            '2025-01-01 balance Assets:Bank 100 CHF',
        ].join('\n')), []);
    });
});
