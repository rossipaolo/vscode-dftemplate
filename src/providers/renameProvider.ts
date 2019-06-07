/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { RenameProvider, TextDocument, Position, WorkspaceEdit, Range, CancellationToken } from 'vscode';
import { Symbol, Task } from '../language/common';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';
import { symbols } from '../parser';

export class TemplateRenameProvider implements RenameProvider {

    public async provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken): Promise<WorkspaceEdit | undefined> {
        const word = parser.getWord(document, position);
        if (word) {
            const edit = new WorkspaceEdit();

            if (parser.isQuestReference(document.lineAt(position.line).text, word)) {
                for (const location of await TemplateReferenceProvider.questReferences(word, true, token)) {
                    edit.replace(location.uri, location.range, newName);
                }
            } else {
                const quest = Quest.get(document);

                const symbolOrTask = quest.qbn.getSymbol(word) || quest.qbn.getTask(word);
                if (symbolOrTask) {
                    TemplateRenameProvider.renameSymbol(symbolOrTask, newName, quest, edit);
                }
            }

            return edit;
        }
    }

    /**
     * Renames a symbol or a task preserving prefixes and suffixes, if used.
     * @param symbolOrTask Symbol or task instance.
     * @param newName The new name including default prefix and suffix.
     * @param quest The quest where the symbol is defined.
     * @param edit A workspace edit to push the rename operation.
     */
    public static renameSymbol(symbolOrTask: Symbol | Task, newName: string, quest: Quest, edit: WorkspaceEdit) {
        const baseName = parser.symbols.getSymbolName(symbolOrTask.name);

        const supportSubstitutions = symbols.symbolFollowsNamingConventions(symbolOrTask.name) && symbols.symbolFollowsNamingConventions(newName);
        if (supportSubstitutions) {
            newName = parser.symbols.getSymbolName(newName);
        }

        for (const location of symbolOrTask instanceof Symbol ?
            TemplateReferenceProvider.symbolReferences(quest, symbolOrTask, true) :
            TemplateReferenceProvider.taskReferences(quest, symbolOrTask, true)) {

            let range = location.range;
            if (supportSubstitutions) {
                const offset = quest.document.getText(location.range).indexOf(baseName);
                range = new Range(range.start.line, range.start.character + offset, range.start.line, range.start.character + offset + baseName.length);
            }

            edit.replace(quest.document.uri, range, newName);
        }
    }
}