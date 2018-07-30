/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

export class TemplateDocumentHighlightProvider implements vscode.DocumentHighlightProvider {

    public provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.DocumentHighlight[]> {
        return new Promise((resolve, reject) => {

            const word = parser.getWord(document, position);
            if (word) {

                const highlights: vscode.DocumentHighlight[] = [];

                for (const range of parser.findSymbolReferences(document, parser.getSymbolName(word), true)) {
                    highlights.push(new vscode.DocumentHighlight(range, vscode.DocumentHighlightKind.Write));
                }

                return resolve(highlights);
            }

            return reject();
        });
    }
}