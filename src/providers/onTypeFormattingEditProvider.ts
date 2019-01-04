/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { Formatter } from '../formatter';

export class TemplateOnTypingFormatter implements vscode.OnTypeFormattingEditProvider {

    public provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, ch: string,
        options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
        return new Promise(resolve => {
            const formatter = new Formatter(document, options, false);
            const line = document.lineAt(position.line);
            return resolve(parser.isQuestTable(document) ?
            formatter.formatTable(line.rangeIncludingLineBreak) : formatter.formatQuest(line.rangeIncludingLineBreak));
        });
    }
}