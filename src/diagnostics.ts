import * as path from 'path';
import * as vscode from 'vscode';

import { FinError, parseFinErrors, run } from './fin';
import { rootJournal } from './journal';

/**
 * Publishes what fin has to say about the journal.
 *
 * With fin.journal set, `fin balance` runs over the whole journal, which also
 * reports accounts booked to before they are opened and balance assertions
 * that do not hold. Without it only the edited file is checked, with
 * `fin parse`, which cannot report either: an included fragment does not open
 * the accounts it books to, so checking it alone would invent errors.
 *
 * fin reads from disk, so a check runs when a file is opened or saved rather
 * than while it is being typed into.
 */
export class Diagnostics implements vscode.Disposable {
    private readonly collection = vscode.languages.createDiagnosticCollection('fin');

    /** What the last run for a target published, so stale entries can be dropped. */
    private readonly published = new Map<string, vscode.Uri[]>();

    /** Runs are serialized: a save during a run must not race its result. */
    private queue: Promise<void> = Promise.resolve();

    constructor(private readonly log: vscode.OutputChannel) { }

    dispose(): void {
        this.collection.dispose();
    }

    /** Queues a check of the journal that document belongs to. */
    check(document: vscode.TextDocument): void {
        this.queue = this.queue
            .then(() => this.checkNow(document))
            .catch(e => this.log.appendLine(`${e instanceof Error ? e.message : e}`));
    }

    /** Drops everything published so far, e.g. when the checks are turned off. */
    reset(): void {
        this.collection.clear();
        this.published.clear();
    }

    private async checkNow(document: vscode.TextDocument): Promise<void> {
        const config = vscode.workspace.getConfiguration('fin', document.uri);
        if (!config.get<boolean>('diagnostics.enable', true)) {
            this.reset();
            return;
        }

        const journal = rootJournal(document);
        const target = journal ?? document.uri.fsPath;
        const args = journal ? ['balance', journal] : ['parse', target];

        const { code, output } = await run(args, path.dirname(target));
        const errors = code === 0 ? [] : parseFinErrors(output);
        if (code !== 0 && errors.length === 0) {
            this.log.appendLine(output.trim());
        }
        await this.publish(target, errors, document.uri);
    }

    /**
     * Replaces what the previous run for this target published. An error fin
     * found in an included file is attributed to that file, not to the one
     * that was saved.
     */
    private async publish(target: string, errors: FinError[], fallback: vscode.Uri): Promise<void> {
        const grouped = new Map<string, vscode.Diagnostic[]>();
        for (const error of errors) {
            const uri = error.file ? vscode.Uri.file(error.file) : fallback;
            const diagnostic = new vscode.Diagnostic(
                await this.range(uri, error),
                error.message,
                vscode.DiagnosticSeverity.Error);
            diagnostic.source = 'fin';
            const key = uri.toString();
            grouped.set(key, [...(grouped.get(key) ?? []), diagnostic]);
        }

        for (const stale of this.published.get(target) ?? []) {
            if (!grouped.has(stale.toString())) {
                this.collection.delete(stale);
            }
        }

        const published: vscode.Uri[] = [];
        for (const [key, diagnostics] of grouped) {
            const uri = vscode.Uri.parse(key);
            this.collection.set(uri, diagnostics);
            published.push(uri);
        }
        this.published.set(target, published);
    }

    /**
     * fin points at a position, not a span, so the squiggle is widened to the
     * word it starts at where there is one.
     */
    private async range(uri: vscode.Uri, error: FinError): Promise<vscode.Range> {
        if (error.line === undefined || error.column === undefined) {
            return new vscode.Range(0, 0, 0, 0);
        }
        const start = new vscode.Position(error.line - 1, error.column - 1);
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            return document.getWordRangeAtPosition(start) ?? document.lineAt(start.line).range;
        } catch {
            return new vscode.Range(start, start.translate(0, 1));
        }
    }
}
