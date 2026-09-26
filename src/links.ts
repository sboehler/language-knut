import * as path from 'path';
import * as vscode from 'vscode';

/** An include directive: at column zero, with a quoted, non-empty path. */
const INCLUDE = /^include[ \t]+"([^"]+)"/;

export interface Include {
    line: number;
    /** Columns of the path itself, without the quotes around it. */
    start: number;
    end: number;
    path: string;
}

export function findIncludes(text: string): Include[] {
    const includes: Include[] = [];
    const lines = text.split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
        const match = INCLUDE.exec(lines[line]);
        if (!match) {
            continue;
        }
        const start = lines[line].indexOf('"') + 1;
        includes.push({ line, start, end: start + match[1].length, path: match[1] });
    }
    return includes;
}

/**
 * Makes the path of an include directive clickable. It resolves against the
 * directory of the file the directive is in, which is how fin resolves it.
 */
export class IncludeLinks implements vscode.DocumentLinkProvider {

    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const directory = path.dirname(document.uri.fsPath);
        return findIncludes(document.getText()).map(include => new vscode.DocumentLink(
            new vscode.Range(include.line, include.start, include.line, include.end),
            vscode.Uri.file(path.resolve(directory, include.path))));
    }
}
