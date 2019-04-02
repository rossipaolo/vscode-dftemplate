/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Range, FormattingOptions, TextEdit } from 'vscode';
import { Formatter } from '../formatter';
import { Quest } from '../language/quest';

export class TemplateDocumentRangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {

    public provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions): Thenable<TextEdit[]> {
        return new Promise(resolve => {
            const formatter = new Formatter(document, options, true);
            return resolve(Quest.isTable(document.uri) ?
                formatter.formatTable(range) : formatter.formatQuest(range));
        });
    }
}