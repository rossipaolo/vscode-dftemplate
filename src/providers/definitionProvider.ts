/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

import { TextDocument, Position, Location } from 'vscode';

export class TemplateDefinitionProvider implements vscode.DefinitionProvider {

    public provideDefinition(document: TextDocument, position: Position): Thenable<Location> {
        return new Promise(function (resolve, reject) {
            const word = parser.getWord(document, position);
            if (word) {

                // Symbol
                if (parser.isSymbol(word)) {
                    const symbolDefinition = parser.findSymbolDefinition(document, word);
                    if (symbolDefinition) {
                        return resolve(symbolDefinition.location);
                    }

                    const taskDefinition = parser.findTaskDefinition(document, word);
                    if (taskDefinition) {
                        return resolve(new Location(document.uri, new Position(taskDefinition.lineNumber, 0)));
                    }
                }

                // Message
                if (!isNaN(Number(word))) {
                    let messageDefinition = parser.findMessageByIndex(document, word);
                    if (messageDefinition) {
                        return resolve(new Location(document.uri, new Position(messageDefinition.line.lineNumber, 0)));
                    }
                }

                // Quest
                if (parser.isQuestReference(document.lineAt(position.line).text)) {
                    return parser.findQuestDefinition(word).then((quest) => {
                        return resolve(quest.location);
                    }, () => reject());
                }
            }

            return reject();
        });
    }
}