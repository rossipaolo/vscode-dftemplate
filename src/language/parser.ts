/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { TextDocument, Position, Location, Range, TextLine } from 'vscode';

export const enum Types {
    Item = 'Item',
    Person = 'Person',
    Place = 'Place',
    Clock = 'Clock',
    Foe = 'Foe'
}

/**
 * Provides common functionalities for parsing elements from a textDocument.
 */
export class Parser {

    private static readonly types: string[] = ['Item', 'Person', 'Place', 'Clock', 'Foe'];
    private static readonly typesMatch = '\\s*(' + Parser.types.join('|') + ')\\s+';

    public static get questDefinitionPattern(): RegExp { return /^(\s*Quest:\s+)([a-zA-Z0-9]+)/g; }
    public static get questReferencePattern(): RegExp { return /^(\s*start\s+quest\s+)([a-zA-Z0-9]+)/g; }
    public static get displayNamePattern(): RegExp { return /^DisplayName:\s(.*)$/g; }

    /**
     * Get a word from the given position of a document.
     */
    public static getWord(document: TextDocument, position: Position): string | undefined {
        let range = document.getWordRangeAtPosition(position);
        if (range && !range.isEmpty) {
            return document.getText(range);
        }
    }

    /**
     * Find the definition of a symbol and return its location. Undefined if not found.
     */
    public static findSymbolDefinition(document: TextDocument, word: string): { location: Location, type: string } | undefined {
        word = this.getBaseSymbol(word);
        let text = document.getText();
        if (text) {
            for (var i = 0; i < this.types.length; i++) {
                let seekedText = this.types[i] + ' ' + word;
                let index = text.indexOf(seekedText);
                if (index !== -1) {
                    return {
                        location: new Location(document.uri, new Range(document.positionAt(index), document.positionAt(index + seekedText.length))),
                        type: this.types[i]
                    };
                }
            }
        }
    }

    /**
     * Find the definition type of a symbol.
     */
    public static getSymbolType(document: TextDocument, baseSymbol: string): string | undefined {
        const line = Parser.findLine(document, new RegExp(Parser.typesMatch + baseSymbol));
        if (line) {
            const result = /^\s*([a-zA-Z0-9_]+)\s+/.exec(line.text);
            if (result && result.length > 0) {
                return result[1];
            }
        }
    }

    /**
     * Find the definition of a message and return its location. Undefined if not found.
     */
    public static findMessageDefinition(document: TextDocument, word: string): { line: TextLine, isDefault: boolean } | undefined {
        // Default message
        let line = Parser.findLine(document, new RegExp('\\[\\s*' + word + '\\s*\\]', 'g'));
        if (line) {
            return { line: line, isDefault: true };
        }

        // Additional message
        line = Parser.findLine(document, new RegExp('^\\bMessage:\\s+' + word + '\\b', 'g'));
        if (line) {
            return { line: line, isDefault: false };
        }
    }

    /**
     * Find the definition of a default message from its name and return its location. Undefined if not found.
     */
    public static findDefaultMessageByName(document: TextDocument, name: string): TextLine | undefined {
        return Parser.findLine(document, new RegExp('\\s*' + name + '\\s*:\\s*\\[\\s*\\d+\\s*\\]', 'g'));
    }

    /**
     * Find a task from its symbol and return its location. Undefined if not found.
     */
    public static findTask(document: TextDocument, symbol: string) : TextLine | undefined {
        return Parser.findLine(document, new RegExp('^\\s*' + symbol + '\\s+task:'));
    }

    /**
     * Find the first line that matches the regular expression.
     */
    public static findLine(document: TextDocument, regex: RegExp): TextLine | undefined {
        for (let i = 0; i < document.lineCount; i++) {
            let line = document.lineAt(i);
            if (regex.test(line.text)) {
                return line;
            }
        }
    }

    /**
     * Find the first line that matches the regular expression in any document.
     */
    public static findLineInAllfiles(regex: RegExp): Thenable<{ document: TextDocument, line: TextLine }> {
        return new Promise((resolve, reject) => {
            return vscode.workspace.findFiles('*.{txt,dftemplate}').then((uri) => {
                for (let i = 0; i < uri.length; i++) {
                    vscode.workspace.openTextDocument(uri[i]).then((document) => {
                        let line = Parser.findLine(document, regex);
                        if (line) {
                            return resolve({ document: document, line: line });
                        }
                    });
                }

                return reject();
            });
        });
    }

    public static findLinesInAllfiles(regex: RegExp, firstPerFile?: boolean): Thenable<{ document: TextDocument, line: TextLine }[]> {
        return new Promise((resolve) => {
            return vscode.workspace.findFiles('*.{txt,dftemplate}').then((uri) => {
                let results: { document: TextDocument, line: TextLine }[] = [];
                for (let i = 0; i < uri.length; i++) {
                    vscode.workspace.openTextDocument(uri[i]).then((document) => {
                        for (let i = 0; i < document.lineCount; i++) {
                            let line = document.lineAt(i);
                            if (regex.test(line.text)) {
                                results.push({ document: document, line: line });
                                if (firstPerFile) {
                                    break;
                                }
                            }
                        }
                    });
                }

                return resolve(results);
            });
        });
    }

    /**
     * Find all occurrences of a symbol with any prefix.
     * 
     * @param text seek within this string.
     * @param name base name of symbol without prefixes and suffixes.
     * 
     * @returns Indices of names (after prefix).
     */
    public static *allSymbolOccurrences(text: string, name: string): Iterable<number> {
        for (let i = 0; i < text.length; ++i) {
            if (text.substring(i, i + name.length) === name) {
                if (text[i + name.length] === '_' && (text[i - 1] === '_' || text[i - 1] === '=')) {
                    yield i;
                }
            }
        }
    }

    /**
     * Check if a word is a symbol with any accepted prefix.
     */
    public static isSymbol(word: string): boolean {
        return new RegExp(/(_{1,3}|={1,2})\w+_/).test(word);
    }

    /**
     * Find all symbols with any accepted prefix.
     */
    public static findSymbols(line: string): RegExpMatchArray | null {
        return line.match(/(_{1,3}|={1,2})\w+_/g);
    }

    /**
     * Remove prefixes from a derived symbol.
     */
    public static getBaseSymbol(derived: string): string {
        return '_' + derived.replace(/^_+/, '').replace(/^=+/, '');
    }

    /**
     * Remove all prefixes and suffixes from a symbol.
     */
    public static getSymbolName(symbol: string): string {
        return symbol.replace(/^_+/, '').replace(/^=+/, '').replace(/_$/, '');
    }

    /**
     * Check if derived is a variation of base.
     */
    public static isDerived(base: string, derived: string): boolean {
        return new RegExp('(_{1,3}|={1,2})' + base.substring(1), 'g').test(derived);
    }

    /**
     * Check if this line is a symbol definition. 
     */
    public static isSymbolDefinition(line: string, base: string): boolean {
        for (var i = 0; i < this.types.length; i++) {
            if (line.startsWith(this.types[i] + ' ' + base)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if this line is a task definition.
     */
    public static isTask(line: string): boolean {
        return new RegExp(/(task|until\s+(\w|_|=)+\s+performed):\s*$/).test(line);
    }

    public static isQuest(line: string, allowDefinition?:boolean){
        return (allowDefinition ? /(Quest:|start\s+quest)\s/g : /start\s+quest\s/g).test(line);
    }

    public static parseComment(line: string): { isComment: boolean, text: string } {
        if (/^\s*-+/.test(line)) {
            return { isComment: true, text: this.skipWhile(line, (char) => char === ' ' || char === '-') };
        }

        return { isComment: false, text: '' };
    }

    public static makeQuestDefinitionPattern(questName: string) {
        return new RegExp('^\\s*Quest:\\s+' + questName, 'g');
    }

    public static makeQuestReferencePattern(questName: string) {
        return new RegExp('^\\s*start\\s+quest\\s+' + questName, 'g');
    }

    /**
     * Remove chars until condition becomes false.
     */
    private static skipWhile(text: string, condition: (char: string) => boolean): string {
        for (let i = 0; i < text.length; i++) {
            if (!condition(text[i])) {
                return text.substring(i);
            }
        }

        return '';
    }
}
