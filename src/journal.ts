import * as path from 'path';
import * as vscode from 'vscode';

import { findIncludes } from './links';

/**
 * An account name, as fin reads one: one of the five types, then
 * colon-separated alphanumeric segments.
 */
const ACCOUNT = String.raw`(?:Assets|Liabilities|Equity|Income|Expenses)(?::[\p{L}\p{N}]+)*`;

/** An `open` or `close` directive, which fin only reads at column zero. */
const DECLARATION = new RegExp(
    // The name has to end where the account does: `Incomexyz` is no account,
    // and fin reads it as none either.
    String.raw`^(\d{4}-\d{2}-\d{2})[ \t]+(open|close)[ \t]+(${ACCOUNT})(?![\p{L}\p{N}])`, 'u');

/** One `open` or `close` directive, and where the account it names sits. */
export interface Declaration {
    kind: 'open' | 'close';
    account: string;
    /** As written: it is shown, not interpreted. */
    date: string;
    /** 0-based. */
    line: number;
    /** Columns of the account name, without the directive before it. */
    start: number;
    end: number;
}

export function findDeclarations(text: string): Declaration[] {
    const declarations: Declaration[] = [];
    const lines = text.split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
        const match = DECLARATION.exec(lines[line]);
        if (!match) {
            continue;
        }
        declarations.push({
            kind: match[2] === 'open' ? 'open' : 'close',
            account: match[3],
            date: match[1],
            line,
            start: match[0].length - match[3].length,
            end: match[0].length,
        });
    }
    return declarations;
}

/** An account the journal opens. */
export interface Account {
    name: string;
    /** The date of its `open` directive. */
    opened: string;
    /** The date of its `close` directive, if it has one. */
    closed?: string;
    /** The `open` directive itself, so it can be pointed at. */
    where: vscode.Location;
}

/**
 * The root journal, from fin.journal, resolved against the workspace folder
 * the document is in. Undefined when the setting is empty, which leaves no
 * graph to walk from.
 */
export function rootJournal(document: vscode.TextDocument): string | undefined {
    const configured = vscode.workspace
        .getConfiguration('fin', document.uri)
        .get<string>('journal')?.trim();
    if (!configured) {
        return undefined;
    }
    if (path.isAbsolute(configured)) {
        return configured;
    }
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    return folder ? path.join(folder.uri.fsPath, configured) : undefined;
}

/** What one pass over a file's text found. */
interface Parsed {
    declarations: Declaration[];
    /** Absolute, resolved the way fin resolves an include. */
    includes: string[];
}

/**
 * What accounts the journal has, for the features that need to know without
 * asking fin.
 *
 * With fin.journal set, the journal is walked from that file through its
 * includes, which is the set of accounts in scope. Without it there is no root
 * to walk from, so the edited file is walked and every .fin file in the
 * workspace read besides.
 *
 * A file is parsed once and kept until it changes. An open one is read from
 * its buffer rather than from disk, so an account can be completed as soon as
 * it is typed.
 */
export class JournalIndex implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];

    /** Per file, what it declares and includes. Dropped when it changes. */
    private readonly files = new Map<string, Parsed>();

    /** Per journal, the accounts in it. Dropped when any file changes. */
    private readonly journals = new Map<string, Promise<Map<string, Account>>>();

    constructor(private readonly log: vscode.OutputChannel) {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.fin');
        this.disposables.push(
            watcher,
            watcher.onDidCreate(uri => this.forget(uri.fsPath)),
            watcher.onDidChange(uri => this.forget(uri.fsPath)),
            watcher.onDidDelete(uri => this.forget(uri.fsPath)),
            // An open file is read from its buffer, so an edit has to be
            // picked up even though the file on disk has not changed, ...
            vscode.workspace.onDidChangeTextDocument(e => this.forgetDocument(e.document)),
            // ... and closing it unsaved puts the file on disk back.
            vscode.workspace.onDidCloseTextDocument(document => this.forgetDocument(document)));
    }

    dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    /** Every account the journal the document belongs to opens. */
    async accounts(document: vscode.TextDocument): Promise<Account[]> {
        const root = rootJournal(document);
        const target = root ?? document.uri.fsPath;
        let accounts = this.journals.get(target);
        if (!accounts) {
            accounts = this.build(target, root !== undefined);
            this.journals.set(target, accounts);
        }
        return [...(await accounts).values()];
    }

    /** Drops everything read so far, e.g. when fin.journal changes. */
    reset(): void {
        this.files.clear();
        this.journals.clear();
    }

    /**
     * The accounts of the journal at target. Rooted, that is what it includes
     * and nothing else. Unrooted, target is only the file being edited, so the
     * workspace is read as well: an account offered that fin turns out not to
     * have in scope costs a correction, where a missing one costs the
     * completion.
     */
    private async build(target: string, rooted: boolean): Promise<Map<string, Account>> {
        const accounts = new Map<string, Account>();
        try {
            const files = new Set(await this.walk(target));
            if (!rooted) {
                for (const uri of await vscode.workspace.findFiles('**/*.fin')) {
                    files.add(uri.fsPath);
                }
            }

            const declarations: [string, Declaration][] = [];
            for (const file of files) {
                for (const declaration of (await this.parse(file))?.declarations ?? []) {
                    declarations.push([file, declaration]);
                }
            }
            // Opens first: a close may be read before the open it refers to.
            for (const [file, declaration] of declarations) {
                if (declaration.kind === 'open' && !accounts.has(declaration.account)) {
                    accounts.set(declaration.account, {
                        name: declaration.account,
                        opened: declaration.date,
                        where: new vscode.Location(
                            vscode.Uri.file(file),
                            new vscode.Range(
                                declaration.line, declaration.start,
                                declaration.line, declaration.end)),
                    });
                }
            }
            for (const [, declaration] of declarations) {
                const account = accounts.get(declaration.account);
                if (declaration.kind === 'close' && account && !account.closed) {
                    account.closed = declaration.date;
                }
            }
        } catch (e) {
            // The promise is cached, so a rejected one would stick: what could
            // not be read is logged and leaves the accounts it holds out.
            this.log.appendLine(`${e instanceof Error ? e.message : e}`);
        }
        return accounts;
    }

    /** The files of the journal rooted at target, each visited once. */
    private async walk(target: string): Promise<string[]> {
        const queue = [target];
        const seen = new Set<string>();
        // The queue grows while it is walked: an include of an include is
        // appended to it, and a cycle is cut by seen.
        for (let i = 0; i < queue.length; i++) {
            const file = queue[i];
            if (seen.has(file)) {
                continue;
            }
            seen.add(file);
            queue.push(...((await this.parse(file))?.includes ?? []));
        }
        return [...seen];
    }

    /** What a file declares and includes, from its buffer if it is open. */
    private async parse(file: string): Promise<Parsed | undefined> {
        const cached = this.files.get(file);
        if (cached) {
            return cached;
        }
        const text = await this.read(file);
        if (text === undefined) {
            // A file that cannot be read is fin's to complain about.
            return undefined;
        }
        const directory = path.dirname(file);
        const parsed: Parsed = {
            declarations: findDeclarations(text),
            includes: findIncludes(text).map(
                include => path.resolve(directory, include.path)),
        };
        this.files.set(file, parsed);
        return parsed;
    }

    private async read(file: string): Promise<string | undefined> {
        const open = vscode.workspace.textDocuments.find(
            document => document.uri.fsPath === file);
        if (open) {
            return open.getText();
        }
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
            return Buffer.from(bytes).toString('utf8');
        } catch {
            return undefined;
        }
    }

    private forget(file: string): void {
        this.files.delete(file);
        // A file may be in any journal, and one that appeared or went is in
        // the set the workspace stands in for.
        this.journals.clear();
    }

    /**
     * Only a file the index has read matters, which also keeps a keystroke in
     * an unrelated document from clearing it.
     */
    private forgetDocument(document: vscode.TextDocument): void {
        if (this.files.has(document.uri.fsPath)) {
            this.forget(document.uri.fsPath);
        }
    }
}
