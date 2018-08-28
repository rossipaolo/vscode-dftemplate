/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { RenameProvider, TextDocument, Position, WorkspaceEdit } from 'vscode';

export class TemplateRenameProvider implements RenameProvider {

    public provideRenameEdits(document: TextDocument, position: Position, newName: string): Thenable<WorkspaceEdit> {
        return new Promise(function (resolve, reject) {
            const word = parser.getWord(document, position);
            if (word) {
                const edit = new WorkspaceEdit();

                if (parser.isSymbol(word)) {
                    newName = parser.getSymbolName(newName);
                    for (const range of parser.findSymbolReferences(document, word, true, true)) {
                        edit.replace(document.uri, range, newName);
                    }
                    return resolve(edit);
                }
                
                if (parser.isQuestReference(document.lineAt(position.line).text)) {
                    return parser.findQuestReferences(word).then((locations) => {
                        for (const location of locations) {
                            edit.replace(location.uri, location.range, newName);
                        }
                        return resolve(edit);
                    }, () => reject());
                }
            }

            return reject();
        });
    }
}