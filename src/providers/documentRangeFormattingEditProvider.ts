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
        return new Promise(resolve => {
            const formatter = new Formatter(document, options, true);
            return resolve(parser.isQuestTable(document) ?
                formatter.formatTable(range) : formatter.formatQuest(range));
        });
    }
}