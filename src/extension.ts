import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.languages.registerFoldingRangeProvider("knut", new KnutFoldingProvider());
    context.subscriptions.push(disposable);

    const disp = vscode.languages.registerDocumentSymbolProvider("knut", new KnutOutlineProvider());
    context.subscriptions.push(disp);
}

// this method is called when your extension is deactivated
export function deactivate() { }


class KnutFoldingProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
        const result: vscode.FoldingRange[] = [];
        const stack: (vscode.FoldingRange | undefined)[] = [];
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
                    r.end = l - 1;
                    result.push(r);
                }
            }
            while (stack.length < stars - 1) {
                stack.push(new vscode.FoldingRange(-1, -1));
            }
            stack.push(new vscode.FoldingRange(l, l));
        }
        while (stack.length > 0) {
            const r = stack.pop();
            if (r) {
                r.end = document.lineCount - 1;
                result.push(r);
            }
        }
        return result;
    }

}


class KnutOutlineProvider implements vscode.DocumentSymbolProvider {

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
            const s = new vscode.DocumentSymbol(line.text.substr(stars).trim(), "", vscode.SymbolKind.Function, line.range, line.range);
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