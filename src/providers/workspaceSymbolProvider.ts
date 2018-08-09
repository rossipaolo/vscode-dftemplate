/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

export class TemplateWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {

    public provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {

        if (/^\s*$/.test(query)) {
            return Promise.reject();
        }

        query = query.toLowerCase();
        return new Promise((resolve, reject) => {
            parser.findAllQuests(token).then((quests) => {
                return resolve(quests.reduce((symbolInformations, quest) => {
                    if (quest.pattern.toLowerCase().indexOf(query) !== -1) {
                        symbolInformations.push(new vscode.SymbolInformation(quest.pattern, vscode.SymbolKind.Class, '', quest.location));
                    }
                    return symbolInformations;
                }, new Array<vscode.SymbolInformation>()));
            }, () => reject());
        });
    }
}