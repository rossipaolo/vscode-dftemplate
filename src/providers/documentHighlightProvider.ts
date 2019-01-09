/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';
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
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(
                        TemplateReferenceProvider.messageReferences(quest, message, false), message.range));
                }

                // Symbol
                const symbol = quest.qbn.getSymbol(word);
                if (symbol) {
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(
                        TemplateReferenceProvider.symbolReferences(quest, symbol, false), symbol.range));
                }

                // Task
                const task = quest.qbn.getTask(word);
                if (task) {
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(
                        TemplateReferenceProvider.taskReferences(quest, task, false), task.range));
                }

                // Action
                const action = first(quest.qbn.iterateActions(), x => x.line.lineNumber === position.line);
                if (action && action.getName() === word) {
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(
                        TemplateReferenceProvider.actionReferences(quest, action)));
                }

                // Symbol macro
                if (word.startsWith('%')) {
                    return resolve(TemplateDocumentHighlightProvider.makeHighlights(
                        TemplateReferenceProvider.symbolMacroReferences(quest, word)
                    ));
                }
            }

            return reject();
        });
    }

    private static makeHighlights(references: vscode.Location[], definition?: vscode.Range) {
        const highlights = references.map(x => new vscode.DocumentHighlight(x.range, vscode.DocumentHighlightKind.Read));
        if (definition) {
            highlights.push(new vscode.DocumentHighlight(definition, vscode.DocumentHighlightKind.Write));
        }
        return highlights;
    }
}