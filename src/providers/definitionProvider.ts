/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { TextDocument, Position, Location } from 'vscode';
import { Parser } from '../language/parser';

export class TemplateDefinitionProvider implements vscode.DefinitionProvider {

    public provideDefinition(document: TextDocument, position: Position): Thenable<Location> {
        return new Promise(function (resolve, reject) {
            let word = Parser.getWord(document, position);
            if (word) {

                // Symbol
                if (Parser.isSymbol(word)) {
                    let symbolDefinition = Parser.findSymbolDefinition(document, word);
                    if (symbolDefinition) {
                        return resolve(symbolDefinition.location);
                    }
                }

                // Message
                if (!isNaN(Number(word))) {
                    let messageDefinition = Parser.findMessageDefinition(document, word);
                    if (messageDefinition) {
                        return resolve(new Location(document.uri, new Position(messageDefinition.line.lineNumber, 0)));
                    }
                }
            }

            return reject();
        });
    }
}