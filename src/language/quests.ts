/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Quest } from './quest';
import { Language } from './static/language';
import { TEMPLATE_LANGUAGE } from '../extension';

/**
 * Manages quest files inside a workspace.
 */
export class Quests {
    private readonly quests = new Map<string, Quest>();

    public constructor(private readonly language: Language) {
    }

    /**
     * Registers to documents events.
     */
    public initialize(): vscode.Disposable {
        const fsWatcher = vscode.workspace.createFileSystemWatcher('**/*.txt', true, true, false);
        fsWatcher.onDidDelete(uri => {
            if (this.quests.has(uri.fsPath)) {
                this.quests.delete(uri.fsPath);
            }
        });
        return fsWatcher;
    }

    /**
     * Gets a `Quest` instance for the given document.
     * @param document A text document with a quest to be parsed.
     */
    public get(document: vscode.TextDocument): Quest {
        let quest = this.quests.get(document.uri.fsPath);
        if (!quest || document.version > quest.version) {
            this.quests.set(document.uri.fsPath, quest = new Quest(document, this.language));
        }

        return quest;
    }

    /**
     * Gets all quests in the current workspace.
     * @param token An optional cancellation token.
     */
    public async getAll(token?: vscode.CancellationToken): Promise<Quest[]> {
        const quests: Quest[] = [];

        const uris = await vscode.workspace.findFiles('**/*.txt', undefined, undefined, token);
        for (const uri of uris.filter(x => !Quest.isTable(x))) {
            const quest = this.quests.get(uri.fsPath);
            if (quest) {
                quests.push(quest);
            } else {
                const document = await vscode.workspace.openTextDocument(uri);
                if (document && document.languageId === TEMPLATE_LANGUAGE) {
                    quests.push(this.get(document));
                }
            }
        }

        return quests;
    }
}