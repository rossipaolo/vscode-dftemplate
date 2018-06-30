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

                // Rename quest
                if (Parser.isQuest(document.lineAt(position.line).text), true) {
                    return Parser.findLinesInAllfiles(Parser.makeQuestReferencePattern(word)).then(results => {
                        return Parser.findLineInAllfiles(Parser.makeQuestDefinitionPattern(word!)).then(definitionResults => {
                            let definition = Parser.questDefinitionPattern.exec(definitionResults.line.text);
                            if (definition) {
                                // Definition
                                let definitionLine = definitionResults.line.lineNumber;
                                let definitionIndex = definition[1].length;
                                edit.replace(definitionResults.document.uri, new Range(definitionLine, definitionIndex, definitionLine, definitionIndex + definition[2].length), newName);

                                // References
                                for (const result of results) {
                                    let reference = Parser.questReferencePattern.exec(result.line.text);
                                    if (reference) {
                                        let referenceLineNumber = result.line.lineNumber;
                                        let referenceIndex = reference[1].length;
                                        edit.replace(result.document.uri, new Range(referenceLineNumber, referenceIndex, referenceLineNumber, referenceIndex + reference[2].length), newName);
                                    }
                                }

                                return resolve(edit);
                            }

                            return reject();
                        }, () => { return reject(); });
                    }, () => { return reject(); });
                }

                // Rename single word
                let range = document.getWordRangeAtPosition(position);
                if (range) {
                    edit.replace(document.uri, range, newName);
                    return resolve(edit);
                }  
            }

            return reject();
        });
    }
}