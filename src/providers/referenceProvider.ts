/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { ReferenceProvider, TextDocument, Position, Location } from 'vscode';
import { Parser } from '../language/parser';

export class TemplateReferenceProvider implements ReferenceProvider {

    public provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean }): Thenable<Location[]> {
        return new Promise(function (resolve, reject) {
            let word = Parser.getWord(document, position);
            if (word && Parser.isSymbol(word)) {            
                let baseSymbol = Parser.getBaseSymbol(word);
                let locations: Location[] = [];
                for (let i = 0; i < document.lineCount; i++) {
                    let line = document.lineAt(i);
                    if (options.includeDeclaration || !Parser.isSymbolDefinition(line.text, baseSymbol)) {
                        let symbols = Parser.findSymbols(line.text);
                        if (symbols) {
                            symbols.forEach(symbol => {
                                if (Parser.isDerived(baseSymbol, symbol)) {
                                    locations.push(new Location(document.uri, line.rangeIncludingLineBreak));
                                }
                            });
                        }
                    }
                }

                return resolve(locations);
            }

            return reject();
        });
    }
}