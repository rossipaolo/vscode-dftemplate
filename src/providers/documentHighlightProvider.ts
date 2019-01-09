/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';
import { QuestResource } from '../language/common';
import { first } from '../extension';

export class TemplateDocumentHighlightProvider implements vscode.DocumentHighlightProvider {

    public provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): Thenable<vscode.DocumentHighlight[]> {
        return new Promise((resolve, reject) => {

            const word = parser.getWord(document, position);
            if (word) {

                const quest = Quest.get(document);

                // Message
                const message = quest.qrc.getMessage(word);
                if (message) {
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(message,
                        TemplateReferenceProvider.messageReferences(quest, message, false)));
                }

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

                // Action
                const action = first(quest.qbn.iterateActions(), x => x.line.lineNumber === position.line);
                if (action && action.getName() === word) {
                    const references = TemplateReferenceProvider.actionReferences(quest, action);
                    return resolve(references.map(x => new vscode.DocumentHighlight(x.range, vscode.DocumentHighlightKind.Read)));
                }

                // Symbol macro
                if (word.startsWith('%')) {
                    const references = TemplateReferenceProvider.symbolMacroReferences(quest, word);
                    return resolve(references.map(x => new vscode.DocumentHighlight(x.range, vscode.DocumentHighlightKind.Read)));
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