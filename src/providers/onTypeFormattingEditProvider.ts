/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Formatter } from '../formatter';
import { Quests } from '../language/quests';

export class TemplateOnTypingFormatter implements vscode.OnTypeFormattingEditProvider {

    public provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, ch: string,
        options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
        return new Promise(resolve => {
            const formatter = new Formatter(document, options, false);
            const line = document.lineAt(position.line);
            return resolve(Quests.isTable(document.uri) ?
            formatter.formatTable(line.rangeIncludingLineBreak) : formatter.formatQuest(line.rangeIncludingLineBreak));
        });
    }
}