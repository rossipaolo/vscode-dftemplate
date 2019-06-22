/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { RenameProvider, TextDocument, Position, WorkspaceEdit, Range, CancellationToken } from 'vscode';
import { Symbol, Task, Message } from '../language/common';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';
import { symbols } from '../parser';
import { Quests } from '../language/quests';

export class TemplateRenameProvider implements RenameProvider {

    public constructor(private readonly quests: Quests) {
    }

    public async provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken): Promise<WorkspaceEdit | undefined> {
        if (Quest.isTable(document.uri)) {
            return;
        }

        const quest = this.quests.get(document);
        const resource = quest.getResource(position);
        if (resource) {
            switch (resource.kind) {
                case 'message':
                    return TemplateRenameProvider.renameMessage(quest, resource.value, newName);
                case 'symbol':
                case 'task':
                    return TemplateRenameProvider.renameSymbol(quest, resource.value, newName);
                case 'quest':
                    return TemplateRenameProvider.renameQuest(this.quests, resource.value, newName, token);
            }
        }
    }

    /**
     * Renames a message inside the given quest.
     * @param quest The quest where the message is defined.
     * @param message Message instance.
     * @param newName The new name for the message.
     */
    public static renameMessage(quest: Quest, message: Message, newName: string): WorkspaceEdit | undefined {
        if (message.alias === undefined) {
            const edit = new WorkspaceEdit();

            for (const location of TemplateReferenceProvider.messageReferences(quest, message, true)) {
                edit.replace(location.uri, location.range, newName);
            }

            return edit;
        }
    }

    /**
     * Renames a symbol or a task preserving prefixes and suffixes, if used.
     * @param quest The quest where the symbol is defined.
     * @param symbolOrTask Symbol or task instance.
     * @param newName The new name including default prefix and suffix.
     */
    public static renameSymbol(quest: Quest, symbolOrTask: Symbol | Task, newName: string): WorkspaceEdit {
        const baseName = parser.symbols.getSymbolName(symbolOrTask.name);

        const supportSubstitutions = symbols.symbolFollowsNamingConventions(symbolOrTask.name) && symbols.symbolFollowsNamingConventions(newName);
        if (supportSubstitutions) {
            newName = parser.symbols.getSymbolName(newName);
        }

        const edit = new WorkspaceEdit();

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

        return edit;
    }

    /**
     * Renames a quest inside the current workspace.
     * @param quests Quests inside target workspace.
     * @param name The current name of the quest.
     * @param newName The new name for the quest.
     * @param token Optional cancellation token.
     */
    public static async renameQuest(quests: Quests, name: string, newName: string, token?: CancellationToken): Promise<WorkspaceEdit> {
        const edit = new WorkspaceEdit();

        for (const location of await TemplateReferenceProvider.questReferences(quests, name, true, token)) {
            edit.replace(location.uri, location.range, newName);
        }

        return edit;
    }
}