/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { RenameProvider, TextDocument, Position, WorkspaceEdit, Range } from 'vscode';
import { Parser } from '../language/parser';

export class TemplateRenameProvider implements RenameProvider {

    public provideRenameEdits(document: TextDocument, position: Position, newName: string): Thenable<WorkspaceEdit> {
        return new Promise(function (resolve, reject) {
            let word = Parser.getWord(document, position);
            if (word) {
                let edit = new WorkspaceEdit();
                if (Parser.isSymbol(word)) {
                    // Rename all occurrences of the symbol
                    let name = Parser.getSymbolName(word);
                    newName = Parser.getSymbolName(newName);
                    for (let i = 0; i < document.lineCount; i++) {
                        let text = document.lineAt(i).text;
                        for (let index of Parser.allSymbolOccurrences(text, name)) {
                            edit.replace(document.uri, new Range(i, index, i, index + name.length), newName);
                        }
                    }

                    return resolve(edit);
                }
                else {
                    // Rename single word
                    let range = document.getWordRangeAtPosition(position);
                    if (range) {
                        edit.replace(document.uri, range, newName);
                        return resolve(edit);
                    }
                }    
            }

            return reject();
        });
    }
}