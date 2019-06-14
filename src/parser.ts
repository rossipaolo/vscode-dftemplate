/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Position, TextLine } from 'vscode';
import { EOL } from 'os';

/**
* Gets a word from the given position of a document.
* @param document A quest document.
* @param position The position in the document.
*/
export function getWord(document: TextDocument, position: Position): string | undefined {
    const range = document.getWordRangeAtPosition(position);
    if (range && !range.isEmpty) {
        return document.getText(range);
    }
}

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
    const index = line.text.indexOf(word);
    return index !== -1 ?
        new vscode.Range(line.lineNumber, index, line.lineNumber, index + word.length) :
        new vscode.Range(line.lineNumber, 0, line.lineNumber, 0);
}

/**
 * Checks if a line is empty or a comment.
 * @param text A line of a quest.
 */
export function isEmptyOrComment(text: string): boolean {
    return /^\s*(-.*)?\s*$/.test(text);
}

/**
 * Finds a comment block above a definition and returns its content.
 * @param document A quest document.
 * @param definitionLine Line index of item whose summary is requested.
 */
export function makeSummary(document: TextDocument, definitionLine: number): string {
    let summary: string = '';
    let text;
    while (definitionLine > 0 && /^\s*-+/.test(text = document.lineAt(--definitionLine).text)) {
        summary = (/^\s*-+\s*$/.test(text) ? EOL.repeat(2) : text.replace(/^\s*-+\s*/, '') + ' ') + summary;
    }
    return summary.trim();
}

/**
 * Checks if `line` has a reference to the quest `name`.
 * This is the quest directive in the preamble or the `start quest` action.
 * @param line A line in a quest file.
 * @param name The name of the referenced quest.
 */
export function isQuestReference(line: string, name: string) {
    return new RegExp('^\\s*(Quest:|start\\s+quest)\\s+' + name).test(line);
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
 * Gets the schema of a table.
 * @param document A document with a table.
 * @returns An array of schema items.
 * @example
 * // schema: id,*name
 * ['id', '*name']
 */
export function getTableSchema(document: TextDocument): string[] | undefined {
    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);
        const schemaIndex = line.text.indexOf('schema:');
        if (schemaIndex !== -1) {
            return line.text.substring(schemaIndex + 'schema:'.length).split(',').map(x => x.trim());
        }
    }
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

    let globalVarsAlternation: string;
    let globalMatch: RegExp;

    /**
     * Set known names and numbers of global variables used in the main quest.
     * @param globalVars A map of global variables.
     */
    export function setGlobalVariables(globalVars: Map<string, number>) {
        const globalVariables = Array.from(globalVars.keys());
        globalVarsAlternation = globalVariables.join('|');
        globalMatch = new RegExp('^\\s*(' + globalVarsAlternation + ')\\s+([a-zA-Z0-9._]+)');
    }

    /**
     * Attempts to parse a task definition from the given text line.
     * @param text A text line.
     * @returns The name and type of the task if parse operation was successful, `undefined` otherwise.
     */
    export function parseTask(text: string): TaskDefinition | undefined {
        let results = text.match(/^\s*([a-zA-Z0-9\._-]+)\s*task:/);
        if (results) {
            return { symbol: results[1], type: TaskType.Standard };
        }

        results = text.match(/^\s*until\s*([a-zA-Z0-9\._-]+)\s*performed/);
        if (results) {
            return { symbol: results[1], type: TaskType.PersistUntil };
        }

        results = text.match(/^\s*variable\s*([a-zA-Z0-9\._-]+)/);
        if (results) {
            return { symbol: results[1], type: TaskType.Variable };
        }

        results = text.match(globalMatch);
        if (results) {
            return { globalVarName: results[1], symbol: results[2], type: TaskType.GlobalVarLink };
        }
    }
}