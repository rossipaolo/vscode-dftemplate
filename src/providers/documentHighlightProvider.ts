/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';

export class TemplateDocumentHighlightProvider implements vscode.DocumentHighlightProvider {

    public provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.DocumentHighlight[]> {
        return new Promise((resolve, reject) => {

            const word = parser.getWord(document, position);
            if (word) {

                const quest = Quest.get(document);

                // Symbol
                const symbol = quest.qbn.getSymbol(word);
                if (symbol) {
                    const references = TemplateReferenceProvider.symbolReferences(quest, symbol, true);
                    const highlights = references.map(x => new vscode.DocumentHighlight(x.range, vscode.DocumentHighlightKind.Read));
                    return resolve(highlights);
                }
            }

            return reject();
        });
    }
}