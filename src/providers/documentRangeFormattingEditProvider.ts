/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { TextDocument, TextLine, Range, FormattingOptions, TextEdit } from 'vscode';
import { Formatter, FormatterResults } from '../language/formatter';

export class TemplateDocumentRangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {

    private static formatters: { (line: TextLine): FormatterResults | undefined }[] = [
        Formatter.formatComment,
        Formatter.formatCenteredMessage,
        Formatter.formatSymbolDefinition
    ];

    public provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions): Thenable<TextEdit[]> {
        return new Promise(function (resolve, reject) {
            let textEdits: TextEdit[] = [];
            for (let i = range.start.line; i <= range.end.line; i++) {
                let line = document.lineAt(i);
                for (let j = 0; j < TemplateDocumentRangeFormattingEditProvider.formatters.length; j++) {
                    let results = TemplateDocumentRangeFormattingEditProvider.formatters[j](line);
                    if (results) {
                        if (results.needsEdit && results.textEdit) {
                            textEdits.push(results.textEdit);
                        }

                        break;
                    }
                }
            }

            return textEdits.length > 0 ? resolve(textEdits) : reject();
        });
    }
}