import * as vscode from 'vscode';

import { AccountCompletions } from './completion';
import { Diagnostics } from './diagnostics';
import { Formatter } from './formatter';
import { JournalIndex } from './journal';
import { IncludeLinks } from './links';

const LANGUAGE = "fin";

export function activate(context: vscode.ExtensionContext) {
    const log = vscode.window.createOutputChannel("fin");
    context.subscriptions.push(log);

    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(LANGUAGE, new FinOutlineProvider()));

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(LANGUAGE, new Formatter(log)));

    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(LANGUAGE, new IncludeLinks()));

    const index = new JournalIndex(log);
    context.subscriptions.push(index);
    context.subscriptions.push(
        // A colon starts a segment, so completion is offered again after one.
        vscode.languages.registerCompletionItemProvider(
            LANGUAGE, new AccountCompletions(index), ':'));

    const diagnostics = new Diagnostics(log);
    context.subscriptions.push(diagnostics);

    const check = (document: vscode.TextDocument) => {
        if (document.languageId === LANGUAGE) {
            diagnostics.check(document);
        }
    };
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(check),
        vscode.workspace.onDidSaveTextDocument(check),
        // The journal to check and to read the accounts from, and whether
        // to check at all, are all settings.
        vscode.workspace.onDidChangeConfiguration(event => {
            if (!event.affectsConfiguration("fin")) {
                return;
            }
            index.reset();
            diagnostics.reset();
            vscode.workspace.textDocuments.forEach(check);
        }));
    vscode.workspace.textDocuments.forEach(check);
}

// this method is called when your extension is deactivated
export function deactivate() { }


class FinOutlineProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const result: vscode.DocumentSymbol[] = [];
        const stack: (vscode.DocumentSymbol | undefined)[] = [];
        for (let l = 0; l < document.lineCount; l++) {
            const line = document.lineAt(l);
            let stars = 0;
            while (line.text[stars] === '*') {
                stars++;
            }
            if (stars === 0) {
                continue;
            }
            while (stack.length > stars - 1) {
                const r = stack.pop();
                if (r) {
                    r.range = new vscode.Range(r.range.start, document.lineAt(l - 1).range.end);
                }
            }
            const s = new vscode.DocumentSymbol(line.text.slice(stars).trim(), "", vscode.SymbolKind.Function, line.range, line.range);
            let parent;
            for (let i = stack.length - 1; i >= 0; i--) {
                parent = stack[stack.length - 1];
                if (parent) {
                    parent.children.push(s);
                    break;
                }
            }
            if (!parent) {
                result.push(s);
            }
            while (stack.length < stars - 1) {
                stack.push(undefined);
            }
            stack.push(s);
        }
        while (stack.length > 0) {
            const r = stack.pop();
            if (r) {
                r.range = new vscode.Range(r.range.start, document.lineAt(document.lineCount - 1).range.end);
            }
        }
        return result;
    }
}
