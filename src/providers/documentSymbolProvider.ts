/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

import { SymbolInformation } from 'vscode';

export class TemplateDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    private static symbolQueries = (document: vscode.TextDocument) => [
        {
            kind: vscode.SymbolKind.Field,
            result: parser.findAllSymbolDefinitions(document),
            containerName: 'QBN'
        },
        {
            kind: vscode.SymbolKind.Property,
            result: parser.findAllVariables(document),
            containerName: 'QBN'
        },
        {
            kind: vscode.SymbolKind.Struct,
            result: parser.findAllMessages(document),
            containerName: 'QRC',
            getRange: (lineNumber: number) => parser.getMessageRange(document, lineNumber)
        },
        {
            kind: vscode.SymbolKind.Method,
            result: parser.findAllTasks(document),
            containerName: 'QBN',
            getRange: (lineNumber: number) => parser.getTaskRange(document, lineNumber)
        }
    ]

    public provideDocumentSymbols(document: vscode.TextDocument): Thenable<SymbolInformation[]> {
        return new Promise(function (resolve, reject) {
            const symbols: SymbolInformation[] = [];

            const questName = parser.findQuestName(document) || '<quest>';

            // Quest
            symbols.push(new SymbolInformation(
                questName,
                vscode.SymbolKind.Module,
                '',
                new vscode.Location(document.uri, new vscode.Range(0, 0, document.lineCount, 0))
            ));

            // Quest blocks
            const blocksRanges = parser.getQuestBlocksRanges(document);
            symbols.push(new SymbolInformation(
                'QRC',
                vscode.SymbolKind.Class,
                questName,
                new vscode.Location(document.uri, blocksRanges.qrc)
            ));
            symbols.push(new SymbolInformation(
                'QBN',
                vscode.SymbolKind.Class,
                questName,
                new vscode.Location(document.uri, blocksRanges.qbn)
            ));

            // Symbols
            TemplateDocumentSymbolProvider.symbolQueries(document).forEach(query => {
                for (const result of query.result) {
                    symbols.push(new SymbolInformation(
                        result.symbol,
                        query.kind,
                        query.containerName,
                        new vscode.Location(document.uri, query.getRange ? query.getRange(result.line.lineNumber) : result.line.range)
                    ));
                }
            });

            return resolve(symbols);
        });
    }
}