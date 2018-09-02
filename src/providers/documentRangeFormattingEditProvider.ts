/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { TextDocument, Range, FormattingOptions, TextEdit } from 'vscode';
import { Formatter } from '../language/formatter';

export class TemplateDocumentRangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {

    public provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions): Thenable<TextEdit[]> {
        return new Promise((resolve, reject) => {
            const formatter = new Formatter(document, options);
            const textEdits: TextEdit[] = parser.isQuestTable(document) ?
                formatter.formatTable(range) : formatter.formatQuest(range);
            return textEdits.length > 0 ? resolve(textEdits) : reject();
        });
    }
}