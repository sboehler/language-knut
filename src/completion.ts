import * as vscode from 'vscode';

import { Account, JournalIndex } from './journal';

/** The characters an account name is made of. */
const NAME = /[\p{L}\p{N}:]/u;

/** A line fin reads as a comment, which holds no account. */
const COMMENT = /^(#|\/\/|\*)/;

/** A price directive, whose commodities are not accounts. */
const PRICE = /^\d{4}-\d{2}-\d{2}[ \t]+price\b/;

/** A performance annotation, which also names commodities. */
const PERFORMANCE = /^@performance\b/;

/** An amount, which a commodity follows rather than an account. */
const QUANTITY = /^-?\d+(?:\.\d+)?$/;

/** Where an account name is being typed, and what of it is there. */
export interface Slot {
    /** What of the name stands before the cursor. Empty at an open position. */
    prefix: string;
    /** The column the name starts at. */
    start: number;
    /** The column the name ends at, at or after the cursor. */
    end: number;
}

/**
 * Reads back the account name being typed at `character`, if one could go
 * there at all.
 *
 * Every account fin reads starts a line or follows an arrow, so an indented
 * line is a transaction's description and never holds one. What remains to
 * keep out is the commodity that follows an amount, and the other places a
 * bare word appears: a comment, a quoted description, the commodities of a
 * price directive or of a performance annotation.
 */
export function accountSlot(line: string, character: number): Slot | undefined {
    if (COMMENT.test(line) || PRICE.test(line) || PERFORMANCE.test(line) || /^[ \t]/.test(line)) {
        return undefined;
    }
    const before = line.slice(0, character);
    // The one quoted thing on a line is a transaction's description, and no
    // account follows one, let alone stands inside one.
    if (before.includes('"')) {
        return undefined;
    }

    let start = character;
    while (start > 0 && NAME.test(line[start - 1])) {
        start--;
    }
    let end = character;
    while (end < line.length && NAME.test(line[end])) {
        end++;
    }

    const prefix = line.slice(start, character);
    // An account starts with the capital its type does, which leaves out
    // dates, amounts and every one of fin's lower-case keywords.
    if (prefix && !/^[A-Z]/.test(prefix)) {
        return undefined;
    }
    // What stands before the name: after an amount comes its commodity.
    const preceding = before.slice(0, start).trimEnd().split(/[ \t]+/).pop() ?? '';
    if (QUANTITY.test(preceding)) {
        return undefined;
    }
    return { prefix, start, end };
}

/**
 * Completes account names from what the journal opens.
 *
 * Every account is offered and VS Code filters them, so that a few letters per
 * segment are enough: `AsBaCh` finds `Assets:Bank:Checking`. A position where
 * nothing has been typed yet is only completed when completion is asked for,
 * so that a space does not put the whole chart of accounts on the screen.
 */
export class AccountCompletions implements vscode.CompletionItemProvider {

    constructor(private readonly index: JournalIndex) { }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): Promise<vscode.CompletionItem[] | undefined> {
        const slot = accountSlot(document.lineAt(position.line).text, position.character);
        if (!slot) {
            return undefined;
        }
        if (!slot.prefix && context.triggerKind !== vscode.CompletionTriggerKind.Invoke) {
            return undefined;
        }
        const accounts = await this.index.accounts(document);
        if (token.isCancellationRequested) {
            return undefined;
        }
        return accounts.map(account => item(account, position, slot));
    }
}

/**
 * An account holds colons, which are no word characters, so every item carries
 * the range it stands for: without it VS Code would filter what was typed
 * since the last colon against the whole name, and match nothing.
 */
function item(account: Account, position: vscode.Position, slot: Slot): vscode.CompletionItem {
    const item = new vscode.CompletionItem(account.name, vscode.CompletionItemKind.Class);
    item.range = {
        inserting: new vscode.Range(position.line, slot.start, position.line, position.character),
        replacing: new vscode.Range(position.line, slot.start, position.line, slot.end),
    };
    item.detail = account.closed
        ? `opened ${account.opened}, closed ${account.closed}`
        : `opened ${account.opened}`;
    item.documentation = new vscode.MarkdownString(
        `\`open\` in ${vscode.workspace.asRelativePath(account.where.uri)}, `
        + `line ${account.where.range.start.line + 1}`);
    // A closed account can still be booked to before it was closed, so it is
    // offered, but under the ones that are still open.
    item.sortText = `${account.closed ? 1 : 0} ${account.name}`;
    return item;
}
