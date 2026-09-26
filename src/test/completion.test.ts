import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { accountSlot } from '../completion';

suite('accountSlot', () => {

    /** The cursor is written as `|`, which is cut out before the call. */
    const slot = (line: string) => accountSlot(
        line.replace('|', ''), line.indexOf('|'));

    test('reads back what has been typed of the name', () => {
        assert.deepStrictEqual(slot('2025-01-01 open Ass|'), { prefix: 'Ass', start: 16, end: 19 });
    });

    test('takes in the whole name the cursor stands in', () => {
        // Replacing reaches to the end of the name; inserting stops at the
        // cursor, which is what start and the cursor itself give.
        assert.deepStrictEqual(
            slot('2025-01-01 open Ass|ets:Bank'), { prefix: 'Ass', start: 16, end: 27 });
    });

    test('completes a segment after the colon that starts it', () => {
        assert.deepStrictEqual(
            slot('2025-01-01 open Assets:Bank:|'), { prefix: 'Assets:Bank:', start: 16, end: 28 });
    });

    test('completes both accounts of a booking', () => {
        assert.deepStrictEqual(slot('Inc|'), { prefix: 'Inc', start: 0, end: 3 });
        assert.deepStrictEqual(
            slot('Income:Salary Ass|'), { prefix: 'Ass', start: 14, end: 17 });
    });

    test('completes the account an arrow faces', () => {
        assert.deepStrictEqual(slot('-> Exp|'), { prefix: 'Exp', start: 3, end: 6 });
        assert.deepStrictEqual(slot('<- Inc|'), { prefix: 'Inc', start: 3, end: 6 });
    });

    test('completes the accounts of the other directives that name one', () => {
        assert.ok(slot('2025-12-31 close Ass|'));
        assert.ok(slot('2025-01-31 balance Ass|'));
        assert.ok(slot('virtual Ass|'));
        assert.ok(slot('@accrue quarterly 2020-01-01 2020-12-31 Ass|'));
    });

    test('leaves an open position to be asked about', () => {
        // The provider offers nothing here unless completion was invoked, so
        // that a space does not put the chart of accounts on the screen.
        assert.deepStrictEqual(slot('2025-01-01 open |'), { prefix: '', start: 16, end: 16 });
    });

    test('keeps out of the commodity that follows an amount', () => {
        assert.strictEqual(slot('Income:Salary Assets:Bank 6500.00 CH|'), undefined);
        assert.strictEqual(slot('-> Expenses:Fees 1.00 CH|'), undefined);
        assert.strictEqual(slot('2025-01-31 balance Assets:Bank 11800 CH|'), undefined);
        assert.strictEqual(slot('Expenses:Food Assets:Bank -30.00 CH|'), undefined);
    });

    test('keeps out of a price directive, whose commodities are no accounts', () => {
        assert.strictEqual(slot('2025-01-06 price AA|'), undefined);
        assert.strictEqual(slot('2025-01-07 price USD 0.88 CH|'), undefined);
    });

    test('keeps out of a performance annotation', () => {
        assert.strictEqual(slot('@performance(V|'), undefined);
        assert.strictEqual(slot('@performance(VT,US|'), undefined);
    });

    test('keeps out of a comment', () => {
        assert.strictEqual(slot('# Ass|'), undefined);
        assert.strictEqual(slot('// Ass|'), undefined);
        assert.strictEqual(slot('* Ass|'), undefined);
    });

    test('keeps out of a description', () => {
        assert.strictEqual(slot('2025-01-25 "Salary for Ass|'), undefined);
        // An indented line is a description, or the rest of one: every account
        // fin reads starts a line or follows an arrow.
        assert.strictEqual(slot('  Buy 11 VT|'), undefined);
        assert.strictEqual(slot('  Ass|'), undefined);
    });

    test('keeps out of what is no account to begin with', () => {
        // A date, an amount, and fin's keywords are all lower case or digits,
        // where an account starts with the capital of its type.
        assert.strictEqual(slot('2025-01-0|'), undefined);
        assert.strictEqual(slot('2025-01-01 ope|'), undefined);
        assert.strictEqual(slot('inclu|'), undefined);
        assert.strictEqual(slot('Income:Salary Assets:Bank 65|'), undefined);
    });

    test('keeps off the rest of a line a description ends', () => {
        assert.strictEqual(slot('2025-01-25 "Salary" Inc|'), undefined);
    });
});

suite('account completion', () => {
    let directory: string;

    suiteSetup(async () => {
        // Activation is what registers the provider, and it is the first
        // journal opened that triggers it: without waiting, the first test
        // races it.
        const extension = vscode.extensions.getExtension('sboehler.language-fin');
        assert.ok(extension, 'the extension under test is installed');
        await extension.activate();
    });

    setup(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fin-test-'));
    });

    teardown(async () => {
        await fs.rm(directory, { recursive: true, force: true });
    });

    test('offers what the journal opens', async () => {
        const document = await open(directory, 'journal.fin', [
            '2025-01-01 open Assets:Bank:Checking',
            '2025-01-01 open Income:Salary',
            '',
            '2025-01-25 "Salary"',
            'Income:Salary Ass',
        ].join('\n'));

        assert.deepStrictEqual(
            await accounts(document, new vscode.Position(4, 17)),
            ['Assets:Bank:Checking', 'Income:Salary']);
    });

    test('follows an include to the accounts it opens', async () => {
        await fs.writeFile(
            path.join(directory, 'accounts.fin'), '2025-01-01 open Assets:Bank\n', 'utf8');
        const document = await open(directory, 'journal.fin', [
            'include "accounts.fin"',
            '',
            '2025-01-01 open Income:Salary',
            'Income:Salary Ass',
        ].join('\n'));

        assert.deepStrictEqual(
            await accounts(document, new vscode.Position(3, 17)),
            ['Assets:Bank', 'Income:Salary']);
    });

    test('says when an account was opened, and when it was closed again', async () => {
        const document = await open(directory, 'journal.fin', [
            '2025-01-01 open Assets:Bank',
            '2025-06-30 close Assets:Bank',
            'Ass',
        ].join('\n'));

        const [item] = (await completions(document, new vscode.Position(2, 3))).items;
        assert.strictEqual(item.label, 'Assets:Bank');
        assert.strictEqual(item.detail, 'opened 2025-01-01, closed 2025-06-30');
    });

    test('offers an account as soon as it is typed, before it is saved', async () => {
        const document = await open(directory, 'journal.fin', [
            '2025-01-01 open Assets:Bank',
            'Ass',
        ].join('\n'));
        const position = new vscode.Position(1, 3);
        assert.deepStrictEqual(await accounts(document, position), ['Assets:Bank']);

        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, new vscode.Position(1, 0), '2025-01-01 open Income:Salary\n');
        assert.ok(await vscode.workspace.applyEdit(edit));
        assert.ok(document.isDirty, 'the account is in the buffer, not on disk');

        // The index is told of the edit through an event, so the account it
        // opens does not have to be there on the next request already.
        await waitFor(
            async () => (await accounts(document, new vscode.Position(2, 3))).length === 2,
            'the account that was typed');
    });

    test('offers nothing where no account can go', async () => {
        const document = await open(directory, 'journal.fin', [
            '2025-01-01 open Assets:Bank',
            '2025-01-25 "Salary for Ass"',
        ].join('\n'));

        assert.deepStrictEqual(await accounts(document, new vscode.Position(1, 26)), []);
    });
});

async function open(directory: string, name: string, text: string): Promise<vscode.TextDocument> {
    const file = path.join(directory, name);
    await fs.writeFile(file, text, 'utf8');
    const document = await vscode.workspace.openTextDocument(file);
    assert.strictEqual(document.languageId, 'fin');
    return document;
}

function completions(
    document: vscode.TextDocument, position: vscode.Position,
): Thenable<vscode.CompletionList> {
    return vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider', document.uri, position);
}

/**
 * The accounts offered at position, in the order they are shown in.
 *
 * The command does not filter the way the editor does, so every account of the
 * journal comes back however much of one has been typed. What VS Code falls
 * back to where nothing at all is offered, the words of the document, is left
 * out: some of them look like accounts.
 */
async function accounts(
    document: vscode.TextDocument, position: vscode.Position,
): Promise<string[]> {
    return (await completions(document, position)).items
        .filter(item => item.kind === vscode.CompletionItemKind.Class)
        .sort((a, b) => `${a.sortText}`.localeCompare(`${b.sortText}`))
        .map(item => typeof item.label === 'string' ? item.label : item.label.label);
}

async function waitFor(condition: () => Promise<boolean>, what: string): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (await condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`timed out waiting for ${what}`);
}
