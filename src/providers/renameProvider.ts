/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';

import { RenameProvider, TextDocument, Position, WorkspaceEdit, Range, CancellationToken } from 'vscode';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';
import { Symbol } from '../language/common';

export class TemplateRenameProvider implements RenameProvider {

    public provideRenameEdits(document: TextDocument, position: Position, newName: string, token: CancellationToken): Thenable<WorkspaceEdit> {
        return new Promise(function (resolve, reject) {
            const word = parser.getWord(document, position);
            if (word) {
                const edit = new WorkspaceEdit();             
                
                if (parser.isQuestReference(document.lineAt(position.line).text, word)) {
                    return TemplateReferenceProvider.questReferences(word, true, token).then(locations => {
                        for (const location of locations) {
                            edit.replace(location.uri, location.range, newName);
                        }
                        return resolve(edit);
                    });
                } else {
                    const quest = Quest.get(document);

                    const symbolOrTask = quest.qbn.getSymbol(word) || quest.qbn.getTask(word);
                    if (symbolOrTask) {          
                        const name = parser.symbols.getSymbolName(word);
                        newName = parser.symbols.getSymbolName(newName);

                        function subRange(range: Range, text: string, subText: string): Range {
                            const offset = text.indexOf(subText);
                            return new Range(range.start.line, range.start.character + offset, range.start.line, range.start.character + offset + subText.length);
                        }

                        for (const location of symbolOrTask instanceof Symbol ?
                            TemplateReferenceProvider.symbolReferences(quest, symbolOrTask, true) :
                            TemplateReferenceProvider.taskReferences(quest, symbolOrTask, true)) {
                            edit.replace(document.uri, subRange(location.range, document.getText(location.range), name), newName);
                        }
                        return resolve(edit);
                    }
                }
            }

            return reject();
        });
    }
}