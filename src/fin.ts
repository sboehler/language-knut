import * as cp from 'child_process';
import * as vscode from 'vscode';

/** One complaint from fin, and where it points. */
export interface FinError {
    message: string;
    /** Absolute, since fin canonicalizes every path it reports. Absent for errors that name no file. */
    file?: string;
    /** 1-based, as printed. Absent when fin reports no position. */
    line?: number;
    column?: number;
}

export interface FinRun {
    code: number;
    /** stdout and stderr together: fin prints its errors to stdout. */
    output: string;
}

function executable(): string {
    return vscode.workspace.getConfiguration('fin').get<string>('executable')?.trim() || 'fin';
}

/**
 * Runs fin and waits for it. Rejects only if the binary could not be started;
 * a journal fin refuses is a resolved run with a non-zero code.
 */
export function run(args: string[], cwd?: string): Promise<FinRun> {
    return new Promise((resolve, reject) => {
        const child = cp.spawn(executable(), args, { cwd });
        let output = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => output += chunk);
        child.stderr.on('data', (chunk: string) => output += chunk);
        child.on('error', (e: NodeJS.ErrnoException) => reject(
            e.code === 'ENOENT'
                ? new Error(`could not run '${executable()}': install fin, or set fin.executable to its location`)
                : e));
        child.on('close', code => resolve({ code: code ?? 0, output }));
    });
}

// fin prints a syntax error, an error it found while building the journal, and
// a file it could not read in three different shapes.
const SYNTAX = /^syntax error:[ \t]*(.*)\r?\n\r?\nIn file "([^"]*)"\r?\nLine (\d+), column (\d+)/m;
const SEMANTIC = /^Error:[ \t]*([\s\S]*?)\r?\n\r?\nDefined in file "([^"]*)", line (\d+), column (\d+)/m;
const UNREADABLE = /^error reading file: (.*):\r?\n(.*)$/m;

/** The production a syntax error was found in, the innermost one first. */
const CONTEXT = /^[ \t]+while parsing (.+?), from line \d+, column \d+$/m;

/**
 * Reads back what fin printed. fin stops at the first error, so this yields at
 * most one, but it yields something for any non-empty output rather than
 * dropping a shape it does not know.
 */
export function parseFinErrors(output: string): FinError[] {
    const syntax = SYNTAX.exec(output);
    if (syntax) {
        const context = CONTEXT.exec(output);
        const detail = context ? ` (while parsing ${context[1]})` : '';
        return [{
            message: `syntax error: ${syntax[1]}${detail}`,
            file: syntax[2],
            line: Number(syntax[3]),
            column: Number(syntax[4]),
        }];
    }

    const semantic = SEMANTIC.exec(output);
    if (semantic) {
        return [{
            message: semantic[1].trim(),
            file: semantic[2],
            line: Number(semantic[3]),
            column: Number(semantic[4]),
        }];
    }

    const unreadable = UNREADABLE.exec(output);
    if (unreadable) {
        return [{ message: `${unreadable[2].trim()}: ${unreadable[1]}`, file: unreadable[1] }];
    }

    const text = output.trim();
    return text ? [{ message: text.split(/\r?\n/)[0] }] : [];
}
