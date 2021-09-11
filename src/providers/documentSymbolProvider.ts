/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { SymbolInformation, SymbolKind } from 'vscode';
import { Quests } from '../language/quests';

export class TemplateDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    public constructor(private readonly quests: Quests) {
    }

    public provideDocumentSymbols(document: vscode.TextDocument): Thenable<SymbolInformation[]> {

        return new Promise(resolve => {
            const symbols: SymbolInformation[] = [];

            const quest = this.quests.get(document);
            const questName = quest.getName() || '<quest>';

            // Quest
            symbols.push(
                new SymbolInformation(
                    questName,
                    SymbolKind.Module,
                    '',
                    quest.getLocation()
                )
            );

            // Quest blocks
            if (quest.qrc.range) {
                symbols.push(new SymbolInformation(
                    'QRC',
                    SymbolKind.Class,
                    questName,
                    quest.getLocation(quest.qrc.range)
                ));
            }
            if (quest.qbn.range) {
                symbols.push(new SymbolInformation(
                    'QBN',
                    SymbolKind.Class,
                    questName,
                    quest.getLocation(quest.qbn.range)
                ));
            }

            // Messages
            for (const message of quest.qrc.messages) {
                symbols.push(new SymbolInformation(
                    String(message.id),
                    vscode.SymbolKind.Struct,
                    'QRC',
                    quest.getLocation(message.blockRange)
                ));
            }

            // Symbols
            for (const symbol of quest.qbn.iterateSymbols()) {
                symbols.push(new SymbolInformation(
                    symbol.name,
                    SymbolKind.Field,
                    'QBN',
                    quest.getLocation(symbol.blockRange)
                ));
            }

            // Tasks
            for (const task of quest.qbn.iterateTasks()) {
                symbols.push(new SymbolInformation(
                    task.node.symbol.value,
                    task.isVariable ? SymbolKind.Variable : SymbolKind.Method,
                    'QBN',
                    quest.getLocation(task.blockRange)
                ));
            }

            return resolve(symbols);
        });
    }
}