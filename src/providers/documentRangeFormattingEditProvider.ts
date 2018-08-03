/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

import { TextDocument, Range, FormattingOptions, TextEdit } from 'vscode';
import { Formatter, FormatterResults } from '../language/formatter';

export class TemplateDocumentRangeFormattingEditProvider implements vscode.DocumentRangeFormattingEditProvider {

    public provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions): Thenable<TextEdit[]> {
        return new Promise(function (resolve, reject) {
            const textEdits: TextEdit[] = [];
            const questBlocks = parser.getQuestBlocksRanges(document);
            for (let i = range.start.line; i <= range.end.line; i++) {
                for (const formatter of i <= questBlocks.qbn.start.line ? Formatter.qrcFormatters : Formatter.qbnFormatters) {
                    const results = formatter(document.lineAt(i));
                    if (results) {
                        if (results.needsEdit && results.textEdit) {
                            textEdits.push(results.textEdit);
                        }

                        // Matching formatter can immediately request the following line.
                        i = TemplateDocumentRangeFormattingEditProvider.tryFormatNextLine(document, i, range.end.line, results, textEdits);
                        break;
                    }
                }
            }

            return textEdits.length > 0 ? resolve(textEdits) : reject();
        });
    }

    /**
     * Give lines to a formatter until it stops matching.
     */
    private static tryFormatNextLine(document: TextDocument, line: number, endLine: number, results: FormatterResults, textEdits: TextEdit[]): number {    
        if (line < endLine) {
            let nextLine = document.lineAt(line + 1);
            if (results.formatNextLineRequest && results.formatNextLineRequest.requestLine(nextLine)) {
                let nextResults = results.formatNextLineRequest.formatLine(nextLine);
                if (nextResults) {
                    if (nextResults.needsEdit && nextResults.textEdit) {
                        textEdits.push(nextResults.textEdit);
                    }

                    return TemplateDocumentRangeFormattingEditProvider.tryFormatNextLine(document, ++line, endLine, nextResults, textEdits);
                }
            }
        }

        return line;
    }
}