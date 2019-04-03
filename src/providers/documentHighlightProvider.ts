/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';

export class TemplateDocumentHighlightProvider implements vscode.DocumentHighlightProvider {

    public async provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.DocumentHighlight[] | undefined> {

        if (Quest.isTable(document.uri)) {
            return;
        }

        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return;
        }

        const word = document.getText(range);
        const quest = Quest.get(document);

        // Message
        const message = quest.qrc.getMessage(word);
        if (message) {
            return TemplateDocumentHighlightProvider.makeHighlights(
                TemplateReferenceProvider.messageReferences(quest, message, false), message.range);
        }

        // Symbol
        const symbol = quest.qbn.getSymbol(word);
        if (symbol) {
            return TemplateDocumentHighlightProvider.makeHighlights(
                TemplateReferenceProvider.symbolReferences(quest, symbol, false), symbol.range);
        }

        // Task
        const task = quest.qbn.getTask(word);
        if (task) {
            return TemplateDocumentHighlightProvider.makeHighlights(
                TemplateReferenceProvider.taskReferences(quest, task, false), task.range);
        }

        // Action
        const action = quest.qbn.getAction(range);
        if (action) {
            return TemplateDocumentHighlightProvider.makeHighlights(
                TemplateReferenceProvider.actionReferences(quest, action));
        }

        // Symbol macro
        if (word.startsWith('%')) {
            return TemplateDocumentHighlightProvider.makeHighlights(
                TemplateReferenceProvider.symbolMacroReferences(quest, word)
            );
        }
    }

    private static makeHighlights(references: vscode.Location[], definition?: vscode.Range) {
        const highlights = references.map(x => new vscode.DocumentHighlight(x.range, vscode.DocumentHighlightKind.Read));
        if (definition) {
            highlights.push(new vscode.DocumentHighlight(definition, vscode.DocumentHighlightKind.Write));
        }
        return highlights;
    }
}