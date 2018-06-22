/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { SymbolInformation } from 'vscode';
import { Parser } from '../language/parser';

export class TemplateDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    public provideDocumentSymbols(document: vscode.TextDocument): Thenable<SymbolInformation[]> {
        return new Promise(function (resolve, reject) {
            var symbols: SymbolInformation[] = [];

            for (var i = 0; i < document.lineCount; i++) {
                let line = document.lineAt(i);

                // Symbols
                let lineSymbols = Parser.findSymbols(line.text);
                if (lineSymbols) {
                    lineSymbols.forEach(symbol => {
                        symbols.push(new SymbolInformation(
                            Parser.getSymbolName(symbol),
                            vscode.SymbolKind.Field,
                            symbol,
                            new vscode.Location(document.uri, line.range)
                        ));
                    });
                }

                // Tasks
                if (Parser.isTask(line.text)) {
                    symbols.push(new SymbolInformation(
                        line.text,
                        vscode.SymbolKind.Function,
                        'task',
                        new vscode.Location(document.uri, line.range)
                    ));
                }
            }

            return resolve(symbols);
        });
    }
}