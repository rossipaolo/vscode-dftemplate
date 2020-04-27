/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, TextLine } from 'vscode';

/**
 * Gets the first word in a line.
 * @param text A line of text.
 */
export function getFirstWord(text: string): string | undefined {
    const match = /^\s*([a-zA-Z_\.']+)/.exec(text);
    if (match) {
        return match[1];
    }
}

/**
 * Gets the range of the first occurrence of `word` in the given text line.
 * @param line A document line.
 * @param word A word to seek in the line.
 * @returns The range of the first occurrence of the word if found, an empty range otherwise.
 */
export function wordRange(line: vscode.TextLine, word: string): vscode.Range {
    return subRange(line.range, line.text, word);
}

/**
 * Gets the range of the first occurence of `subString` inside `text`.
 * @param range The full range of `text`.
 * @param text A string that contains `subString`.
 * @param subString A string contained inside `text`.
 */
export function subRange(range: vscode.Range, text: string, subString: string): vscode.Range {
    if (!range.isSingleLine) {
        throw new Error('Range is not single line');
    }

    const index = text.indexOf(subString);
    if (index === -1) {
        return new vscode.Range(range.start, range.start);
    }

    return new vscode.Range(
        range.start.line, range.start.character + index,
        range.end.line, range.start.character + index + subString.length
    );
}

/**
 * Finds the char index of a word in a string.
 * For example wordIndex 2 in `give item _note_ to _vampleader_` is 5.
 */
export function findWordPosition(text: string, wordIndex: number): number {
    let insideWord = false;
    for (let i = 0; i < text.length; i++) {
        if (!/\s/.test(text[i])) {
            if (!insideWord) {
                if (wordIndex-- === 0) {
                    return i;
                }
                insideWord = true;
            }
        }
        else {
            if (insideWord) {
                insideWord = false;
            }
        }
    }

    return 0;
}

/**
 * Checks if a line is empty or a comment.
 * @param text A line of a quest.
 */
export function isEmptyOrComment(text: string): boolean {
    return /^\s*(-.*)?\s*$/.test(text);
}

/**
 * Parses a quest file to retrieve the ranges of **QRC** and **QBN** blocks.
 * @param document A quest document.
 */
export function getQuestBlocksRanges(document: TextDocument): { qrc: vscode.Range, qbn: vscode.Range } {

    /**
     * Finds the first line that matches a regular expression.
     * @param document A quest document.
     * @param regex A regular expression matched on all lines.
     */
    function findLine(document: TextDocument, regex: RegExp): TextLine | undefined {
        for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
            const line = document.lineAt(lineIndex);
            if (regex.test(line.text)) {
                return line;
            }
        }
    }

    const qrc = findLine(document, /^\s*QRC:\s*$/);
    const qbn = findLine(document, /^\s*QBN:\s*$/);

    return {
        qrc: new vscode.Range(qrc ? qrc.lineNumber : 0, 0, qbn ? qbn.lineNumber - 1 : 0, 0),
        qbn: new vscode.Range(qbn ? qbn.lineNumber : 0, 0, document.lineCount, 0)
    };
}

/**
 * Gets the range of the given line without empty spaces at the borders.
 * @param line A document line.
 */
export function trimRange(line: vscode.TextLine): vscode.Range {
    return new vscode.Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex,
        line.lineNumber, line.text.replace(/\s+$/, '').length);
}

/**
 * Namespace for dealing with parsing messages.
 */
export namespace messages {

    /**
     * Attempts to parse a message definition from the given text line.
     * @param text A text line.
     * @returns The id of the message if parse operation was successful, `undefined` otherwise.
     */
    export function parseMessage(text: string): number | undefined {
        const results = text.match(/^\s*Message:\s+([0-9]+)/);
        if (results) {
            return Number(results[1]);
        }
    }

    /**
     * Attempts to parse a static message definition from the given text line.
     * @param text A text line.
     * @returns The id and name of the static message if parse operation was successful, `undefined` otherwise.
     */
    export function parseStaticMessage(text: string): { id: number, name: string } | undefined {
        const results = text.match(/^\s*(.*):\s+\[\s*([0-9]+)\s*\]\s*$/);
        if (results) {
            return { id: Number(results[2]), name: results[1] };
        }
    }

    /**
     * Detects the range of a message block as lines are being provided. 
     * Also allows to checks multiple lines at once.
     */
    export class MessageBlock {

        private document: TextDocument;
        private lineNumber: number;

        public get currentLine() {
            return this.lineNumber;
        }

        /**
         * Makes a block range check for a message.
         * @param document A quest document.
         * @param lineNumber The QRC line where the message is defined.
         */
        public constructor(document: TextDocument, lineNumber: number) {
            this.document = document;
            this.lineNumber = lineNumber;
        }

        /**
         * Checks that current line is inside a message block. If a line number is provided, 
         * it checks that the block doesn't end before the requested line.
         * @param lineNumber The target line number; must be higher than current.
         */
        public isInside(lineNumber?: number): boolean {

            // End of document
            if (this.isEndOfStream(++this.lineNumber)) {
                return false;
            }

            // Check block ending
            const text = this.document.lineAt(this.lineNumber).text;
            if (text.length === 0 && this.nextLineIsBlockEnding()) {
                return false;
            }

            // Fast forward to requested line
            return lineNumber && lineNumber > this.lineNumber ? this.isInside(lineNumber) : true;
        }

        /**
         * A message block ends with two empty lines or a line followed by another declaration.
         */
        private nextLineIsBlockEnding() {
            if (this.isEndOfStream(this.lineNumber + 1)) {
                return false;
            }

            const text = this.document.lineAt(this.lineNumber + 1).text;
            return text.length === 0 || /^\s*(\s*-.*|.*\[\s*([0-9]+)\s*\]|Message:\s*([0-9]+)|QBN:)\s*$/.test(text);
        }

        private isEndOfStream(lineNumber: number) {
            return lineNumber >= this.document.lineCount;
        }
    }
}

/**
 * Namespace for dealing with parsing symbols.
 */
export namespace symbols {

    /**
     * Attempts to parse a symbol definition from the given text line.
     * @param text A text line.
     * @returns The name of the symbol if parse operation was successful, `undefined` otherwise.
     */
    export function parseSymbol(text: string): string | undefined {
        const results = text.match(/^\s*(?:Person|Place|Item|Foe|Clock)\s*([a-zA-Z0-9._]+)/);
        if (results) {
            return results[1];
        }
    }

    /**
     * Finds all symbols with any accepted prefix.
     * @param line A string to seek symbols within.
     */
    export function findAllSymbolsInALine(line: string): RegExpMatchArray | null {
        return line.match(/(_{1,3}|={1,2})[a-zA-Z0-9_.-]+_/g);
    }

    /**
     * Remove prefixes from a derived symbol. 
     * @param derived An occurrence of a symbol.
     * @example 
     * `__symbol_` -> `_symbol_`
     * `=symbol_` -> `_symbol_`
     * `symbol` -> `symbol`
     */
    export function getBaseSymbol(derived: string): string {
        return derived.replace(/^_+/, '_').replace(/^=+/, '_');
    }

    /**
     * Remove all prefixes and suffixes from a symbol.
     * @param symbol An occurence of a symbol.
     * @example
     * `=symbol_` -> `symbol`
     * `symbol` -> `symbol`
     */
    export function getSymbolName(symbol: string): string {
        return symbol.replace(/^_+/, '').replace(/^=+/, '').replace(/_$/, '');
    }

    /**
     * Makes a regexp that matches all occurrences of a symbol.
     * @param symbol An occurence of a symbol.
     */
    export function makeSymbolRegex(symbol: string): RegExp {
        const name = getSymbolName(symbol);
        return new RegExp(name !== symbol ? '(_{1,4}|={1,2})' + name + '_' : name, 'g');
    }

    /**
     * Checks if a symbol uses the standard `_symbol_` syntax, 
     * which allows to use it inside messages with different prefixes and suffixes.
     * @param symbol A symbol name.
     */
    export function symbolFollowsNamingConventions(symbol: string): boolean {
        return symbol.startsWith('_') && symbol.endsWith('_');
    }

    /**
     * Changes the name of a symbol to follow `_symbol_` convention.
     * @param symbol A symbol name.
     */
    export function forceSymbolNamingConventions(symbol: string): string {
        if (!symbol.startsWith('_')) { symbol = '_' + symbol; }
        if (!symbol.endsWith('_')) { symbol += '_'; }
        return symbol;
    }

    /**
     * Convert a symbol placeholder to its symbol type.
     * @param placeholder A placeholder for a symbol in a snippet.
     * @example 
     * `\${_clock_}` -> `Clock`
     */
    export function symbolPlaceholderToType(placeholder: string) {
        placeholder = placeholder.replace('${_', '').replace('_}', '');
        return placeholder.substring(0, 1).toUpperCase().concat(placeholder.substring(1));
    }
}

/**
 * Namespace for dealing with parsing tasks.
 */
export namespace tasks {

    export enum TaskType {
        /** Is started by a set or trigger: `_foo_ task:` */
        Standard,

        /** Is stopped when symbol flag is true: `until _foo_ performed:`*/
        PersistUntil,

        /** Boolean flag: `variable _foo_` */
        Variable,

        /** Boolean link to global variable: `Bar _foo_`*/
        GlobalVarLink
    }

    /**
     * The definition of a task.
     */
    export interface TaskDefinition {

        /**
         * The symbol that allow to reference this task.
         */
        readonly symbol: string;

        /**
         * What kind of thask this is?
         */
        readonly type: TaskType;

        /**
         * The name of the global variable this task is linked to.
         * `undefined` if the task is local to the quest that owns it.
         */
        readonly globalVarName?: string;
    }

    /**
     * Attempts to parse a task definition from the given text line.
     * @param text A text line.
     * @param globalVars Known global variables.
     * @returns The name and type of the task if parse operation was successful, `undefined` otherwise.
     */
    export function parseTask(text: string, globalVars: Map<string, number>): TaskDefinition | undefined {
        let results = text.match(/^\s*([a-zA-Z0-9\._-]+)\s*task:/);
        if (results !== null) {
            return { symbol: results[1], type: TaskType.Standard };
        }

        results = text.match(/^\s*until\s*([a-zA-Z0-9\._-]+)\s*performed/);
        if (results !== null) {
            return { symbol: results[1], type: TaskType.PersistUntil };
        }

        results = text.match(/^\s*([a-zA-Z0-9\._-]+)\s*([a-zA-Z0-9\._-]+)/);
        if (results !== null) {
            if (results[1] === "variable") {
                return { symbol: results[2], type: TaskType.Variable };
            } else if (globalVars.has(results[1])) {
                return { globalVarName: results[1], symbol: results[2], type: TaskType.GlobalVarLink };
            }
        }
    }
}