/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../language/parser';

import { ReferenceProvider, TextDocument, Position, Location, CancellationToken } from 'vscode';

export class TemplateReferenceProvider implements ReferenceProvider {

    public provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean }, token: CancellationToken): Thenable<Location[]> {
        return new Promise(function (resolve, reject) {
            let word = parser.getWord(document, position);
            if (word) {

                // Symbol
                if (parser.isSymbol(word)) {
                    const symbol = parser.getSymbolName(word);
                    const locations: Location[] = [];
                    for (const range of parser.findSymbolReferences(document, symbol, options.includeDeclaration)) {
                        locations.push(new Location(document.uri, range));
                    }
                    for (const line of parser.findTasksReferences(document, symbol, options.includeDeclaration)) {
                        locations.push(new Location(document.uri, new Position(line.lineNumber, 0)));
                    }
                    return resolve(locations);
                }

                // Messages
                const messages = Array.from(parser.findMessageReferences(document, word, options.includeDeclaration));
                if (messages.length > 0) {
                    return resolve(messages.map(x => new Location(document.uri, x)));
                }
                
                // Quest
                if (parser.isQuestReference(document.lineAt(position.line).text)) {
                    return parser.findQuestReferences(word, token).then((locations) => resolve(locations), () => reject());
                }

                // Global variables
                return parser.findGlobalVarsReferences(word, token).then((locations) => resolve(locations), () => reject());
            }

            return reject();
        });
    }
}