/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Quest } from '../language/quest';

export class TemplateWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {

    public async provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {

        if (/^\s*$/.test(query)) {
            return Promise.reject();
        }

        // Quests
        query = query.toUpperCase();
        const quests = await Quest.getAll(token);
        return quests.reduce((symbols, quest) => {
            const name = quest.getName();
            if (name && name.toUpperCase().includes(query)) {
                symbols.push(new vscode.SymbolInformation(name, vscode.SymbolKind.Class, '', quest.getLocation()));
            }

            return symbols;
        }, new Array<vscode.SymbolInformation>());
    }
}