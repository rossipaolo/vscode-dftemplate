/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';
import { QuestResource } from '../language/common';

export class TemplateDocumentHighlightProvider implements vscode.DocumentHighlightProvider {

    public provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.DocumentHighlight[]> {
        return new Promise((resolve, reject) => {

            const word = parser.getWord(document, position);
            if (word) {

                const quest = Quest.get(document);

                // Symbol
                const symbol = quest.qbn.getSymbol(word);
                if (symbol) {
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(symbol,
                        TemplateReferenceProvider.symbolReferences(quest, symbol, false)));
                }

                // Task
                const task = quest.qbn.getTask(word);
                if (task) {
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(task,
                        TemplateReferenceProvider.taskReferences(quest, task, false)));
                }
            }

            return reject();
        });
    }

    private static makeHighlights(resource: QuestResource, references: vscode.Location[]) {
        const highlights = references.map(x => new vscode.DocumentHighlight(x.range, vscode.DocumentHighlightKind.Read));
        highlights.push(new vscode.DocumentHighlight(resource.range, vscode.DocumentHighlightKind.Write));
        return highlights;
    }
}