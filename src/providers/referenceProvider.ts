/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../language/parser';

import { ReferenceProvider, TextDocument, Position, Location } from 'vscode';

export class TemplateReferenceProvider implements ReferenceProvider {

    public provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean }): Thenable<Location[]> {
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
                    console.log(locations);
                    return resolve(locations);
                }
                
                // Quest
                if (parser.isQuestReference(document.lineAt(position.line).text)) {
                    return parser.findQuestReferences(word);
                }
            }

            return reject();
        });
    }
}