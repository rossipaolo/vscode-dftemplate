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
            if (word && Parser.isSymbol(word)) {
                let definition = Parser.findDefinition(document, word);
                if (definition) {
                    return resolve(definition.location);
                }
            }

            return reject();
        });
    }
}