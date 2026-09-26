import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { parseFinErrors, run } from './fin';

/**
 * Formats with `fin format`, which reads a file rather than stdin, so the
 * buffer is handed over through a temporary file. `--dry-run` keeps fin from
 * writing the formatted journal back over it.
 *
 * Formatting does not follow includes, so it does not matter that the copy
 * sits outside the journal's directory.
 */
export class Formatter implements vscode.DocumentFormattingEditProvider {

    constructor(private readonly log: vscode.OutputChannel) { }

    async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken,
    ): Promise<vscode.TextEdit[]> {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'language-fin-'));
        const copy = path.join(directory, path.basename(document.fileName) || 'journal.fin');
        try {
            await fs.writeFile(copy, document.getText(), 'utf8');
            const { code, output } = await run(['format', '--dry-run', copy]);
            if (code !== 0) {
                // A journal fin cannot parse cannot be formatted; the error is
                // already on its way to the Problems panel.
                this.log.appendLine(parseFinErrors(output).map(e => e.message).join('\n') || output.trim());
                return [];
            }
            if (output === document.getText()) {
                return [];
            }
            const whole = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length));
            return [vscode.TextEdit.replace(whole, output)];
        } catch (e) {
            this.log.appendLine(`${e instanceof Error ? e.message : e}`);
            return [];
        } finally {
            await fs.rm(directory, { recursive: true, force: true });
        }
    }
}
