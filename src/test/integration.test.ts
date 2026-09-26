import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * The fin to test against, which CI does not have: point FIN_TEST_BIN at a
 * built binary to run these. The tests that do not need fin run regardless.
 */
const FIN = process.env.FIN_TEST_BIN;

const JOURNAL = `2025-01-01 open Assets:Bank
2025-01-01 open Income:Salary

2025-01-25 "Salary"
Income:Salary Assets:Bank 5000.00 CHF
`;

const BROKEN = '2025-01-01 open Assets:Bank\n2025-01-02 opne Assets:Foo\n';

suite('fin integration', () => {
    let directory: string;

    suiteSetup(async function () {
        if (!FIN) {
            this.skip();
        }
        await vscode.workspace.getConfiguration('fin')
            .update('executable', FIN, vscode.ConfigurationTarget.Global);
        // Activation is what registers the providers, and opening the first
        // journal is what triggers it: without waiting, the first test races it.
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

    test('formats a journal through fin format', async () => {
        const document = await open(directory, 'journal.fin', JOURNAL);
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand('editor.action.formatDocument');

        // fin pads the booking so that the amounts line up in a column.
        assert.match(document.getText(), /^Income:Salary Assets:Bank {2,}5000\.00 CHF$/m);
        // fin formats a file in place, so the buffer has to be formatted
        // through --dry-run rather than by letting fin write over it.
        assert.ok(document.isDirty, 'the edit is in the buffer, not on disk');
        assert.strictEqual(
            await fs.readFile(document.uri.fsPath, 'utf8'), JOURNAL, 'the file on disk is untouched');
    });

    test('leaves a journal fin cannot parse alone', async () => {
        const document = await open(directory, 'broken.fin', BROKEN);
        // No edits comes back as undefined, not as an empty array.
        assert.ok(!(await format(document.uri))?.length);
    });

    test('reports a syntax error where fin found it', async () => {
        const document = await open(directory, 'broken.fin', BROKEN);
        await waitFor(() => vscode.languages.getDiagnostics(document.uri).length > 0, 'a diagnostic');

        const [diagnostic] = vscode.languages.getDiagnostics(document.uri);
        assert.match(diagnostic.message, /^syntax error:/);
        assert.strictEqual(diagnostic.source, 'fin');
        assert.strictEqual(diagnostic.range.start.line, 1, 'the error is on the second line');
    });

    test('takes back what it reported once the journal is fixed', async () => {
        const document = await open(directory, 'broken.fin', BROKEN);
        await waitFor(() => vscode.languages.getDiagnostics(document.uri).length > 0, 'a diagnostic');

        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(1, 11, 1, 15), 'open');
        assert.ok(await vscode.workspace.applyEdit(edit));
        assert.ok(await document.save());

        await waitFor(() => vscode.languages.getDiagnostics(document.uri).length === 0, 'the diagnostic to clear');
    });

    test('links an include to the file it names', async () => {
        await fs.writeFile(path.join(directory, 'prices.fin'), '', 'utf8');
        const document = await open(directory, 'root.fin', 'include "prices.fin"\n');
        const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
            'vscode.executeLinkProvider', document.uri);

        assert.strictEqual(links?.length, 1);
        assert.strictEqual(links[0].target?.fsPath, path.join(directory, 'prices.fin'));
    });
});

async function open(directory: string, name: string, text: string): Promise<vscode.TextDocument> {
    const file = path.join(directory, name);
    await fs.writeFile(file, text, 'utf8');
    const document = await vscode.workspace.openTextDocument(file);
    assert.strictEqual(document.languageId, 'fin');
    return document;
}

function format(uri: vscode.Uri): Thenable<vscode.TextEdit[] | undefined> {
    return vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatDocumentProvider', uri, { tabSize: 4, insertSpaces: true });
}

/** The checks run fin in the background, so their result has to be waited for. */
async function waitFor(condition: () => boolean, what: string): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`timed out waiting for ${what}`);
}
