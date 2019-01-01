/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { SymbolInformation, SymbolKind } from 'vscode';
import { Quest } from '../language/quest';


export class TemplateDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    public provideDocumentSymbols(document: vscode.TextDocument): Thenable<SymbolInformation[]> {

        return new Promise(resolve => {
            const symbols: SymbolInformation[] = [];

            const quest = new Quest(document);
            const questNameAction = quest.preamble.questName;
            const questName = questNameAction ? questNameAction.signature[1].value : '<quest>';

            // Quest blocks
            symbols.push(
                new SymbolInformation(
                    questName,
                    SymbolKind.Module,
                    '',
                    quest.getLocation()
                ),
                new SymbolInformation(
                    'QRC',
                    SymbolKind.Class,
                    questName,
                    quest.getLocation(quest.qrc)
                ),
                new SymbolInformation(
                    'QBN',
                    SymbolKind.Class,
                    questName,
                    quest.getLocation(quest.qbn)
                )
            );

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
                    quest.getLocation(symbol.range)
                ));
            }

            // Tasks
            for (const task of quest.qbn.iterateTasks()) {
                symbols.push(new SymbolInformation(
                    task.definition.symbol,
                    task.isVariable ? SymbolKind.Variable : SymbolKind.Method,
                    'QBN',
                    quest.getLocation(task.range)
                ));
            }

            return resolve(symbols);
        });
    }
}