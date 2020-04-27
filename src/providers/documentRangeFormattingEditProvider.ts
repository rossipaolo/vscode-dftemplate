/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Range, FormattingOptions, TextEdit } from 'vscode';
import { Formatter } from '../formatter';
import { Quests } from '../language/quests';
import { Tables } from '../language/static/tables';

export class TemplateDocumentRangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {

    public constructor(private readonly tables: Tables) {
    }

    public provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions): Thenable<TextEdit[]> {
        return new Promise(resolve => {
            const formatter = new Formatter(document, options, true, this.tables);
            return resolve(Quests.isTable(document.uri) ?
                formatter.formatTable(range) : formatter.formatQuest(range));
        });
    }
}