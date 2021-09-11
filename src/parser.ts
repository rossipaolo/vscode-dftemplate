/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Position, Range, TextDocument, TextLine } from 'vscode';
import { SymbolType } from './language/static/common';

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

export namespace symbols {

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
 * A syntax node parsed from a quest file.
 */
export interface QuestNode {

    /**
     * The portion of a line where the node is declared.
     */
    readonly range: Range;
}

/**
 * A terminal node of a quest script.
 */
export class QuestToken implements QuestNode {

    /**
     * The start position of the token.
     */
    public readonly position: Position;

    /**
     * The text content of the token.
     */
    public readonly value: string;

    /**
     * The range of the token.
     */
    public get range(): Range {
        return new Range(this.position, new Position(this.position.line, this.position.character + this.value.length));
    }

    public constructor(line: number, character: number, value: string) {
        this.position = new Position(line, character);
        this.value = value;
    }
}

export interface DirectiveNode extends QuestNode {

    /**
     * The name of the directive (`Quest` in `Quest: QUESTNAME`).
     */
    readonly name: QuestToken;

    /**
     * The value assigned to the directive (`QUESTNAME` in `Quest: QUESTNAME`).
     */
    readonly content: QuestToken;
}

/**
 * The definition of a QRC message.
 */
export interface MessageNode extends QuestNode {

    /**
     * The numeric id of the message.
     */
    readonly id: QuestToken;

    /**
     * The text alias if this is a static message, undefined otherwise.
     */
    readonly alias: QuestToken | undefined;

    /**
     * The range of the body of text.
     */
    bodyRange: Range;

    /**
     * Symbols found in the message text.
     */
    symbols?: QuestToken[];

    /**
     * Macros found in the message text.
     */
    macros?: QuestToken[];
}

/**
 * The definition of a QBN resource symbol.
 */
export interface SymbolNode extends QuestNode {

    /**
     * The type of the symbol.
     */
    readonly type: QuestToken;

    /**
     * The name of the symbol.
     */
    readonly name: QuestToken;

    /**
     * The pattern with symbol args.
     */
    readonly pattern: QuestToken | undefined;
}

/**
 * The definition of a task.
 */
export interface TaskNode extends QuestNode {

    /**
     * What kind of thask this is?
     */
    readonly type: TaskType;

    /**
     * The symbol that allow to reference this task.
     */
    readonly symbol: QuestToken;

    /**
     * The name of the global variable this task is linked to.
     * `undefined` if the task is local to the quest that owns it.
     */
    readonly globalVarName?: QuestToken;
}

export class BuiltinTypes {
    private readonly symbolTypes: readonly string[] = Object.values(SymbolType);

    public constructor(private readonly globalVars: { has(value: string): boolean }) {
    }

    /**
     * Checks if a string is the name of a built-in symbol type, like `Place` in `Place _place_`.
     * @param name The name of the type.
     * @returns True if this is a QBN symbol type, false otherwise.
     */
    public isSymbolType(name: string): boolean {
        return this.symbolTypes.includes(name);
    }

    /**
     * Checks if a string is the name of a task "type" (i.e. the alias of a global variable), like `BrisiennaEnding` in `BrisiennaEnding _brisiennaEnding_`.
     * @param name The name of the type.
     * @returns True if this is a task type, false otherwise.
     */
    public isTaskType(name: string): boolean {
        return this.globalVars.has(name);
    }
}

/**
 * Parses syntax nodes from a quest file.
 */
export class NodeParser {

    public constructor(private readonly builtinTypes: BuiltinTypes) {
    }

    public parseDirective(line: TextLine): DirectiveNode | undefined {
        const matchArray: RegExpMatchArray | null = line.text.match(/^(\s*)([a-zA-Z]+)(:\s*)(.+[^\s])(\s*)$/);
        if (matchArray !== null) {
            return {
                range: this.getRange(line),
                name: this.makeTokenFrom(matchArray, 2, line.lineNumber),
                content: this.makeTokenFrom(matchArray, 4, line.lineNumber)
            }
        }
    }

    /**
     * Attempts to parse a message definition from a text line.
     * @param text A text line.
     * @returns Message definition if parse operation was successful, `undefined` otherwise.
     */
    public parseMessage(line: TextLine): MessageNode | undefined {
        const results: RegExpMatchArray | null = line.text.match(/^(\s*)(?:(Message:\s*)([0-9]+)|([a-zA-Z]+)(:\s+\[\s*)([0-9]+)\s*\])\s*$/);
        if (results !== null) {
            const alias: string | undefined = results[4];
            return {
                range: this.getRange(line),
                bodyRange: new Range(line.lineNumber + 1, 0, line.lineNumber + 1, 0),
                id: this.makeTokenFrom(results, alias !== undefined ? 6 : 3, line.lineNumber),
                alias: alias !== undefined ? this.makeTokenFrom(results, 4, line.lineNumber) : undefined
            }
        }
    }

    /**
     * Attempts to parse a symbol definition from a text line.
     * @param text A text line.
     * @returns Symbol definition if parse operation was successful, `undefined` otherwise.
     */
    public parseSymbol(line: TextLine): SymbolNode | undefined {
        const matchArray: RegExpMatchArray | null = line.text.match(/^(\s*)([a-zA-Z]+)(\s*)([a-zA-Z0-9\._]+)(\s*)([^\s].*[^\s])?/);
        if (matchArray !== null && this.builtinTypes.isSymbolType(matchArray[2]) === true) {
            return {
                range: this.getRange(line),
                type: this.makeTokenFrom(matchArray, 2, line.lineNumber),
                name: this.makeTokenFrom(matchArray, 4, line.lineNumber),
                pattern: matchArray[6] !== undefined ? this.makeTokenFrom(matchArray, 6, line.lineNumber) : undefined
            }
        }
    }

    /**
     * Attempts to parse a task definition from a text line.
     * @param text A text line.
     * @returns Task definition if parse operation was successful, `undefined` otherwise.
     */
    public parseTask(line: TextLine): TaskNode | undefined {
        let results: RegExpMatchArray | null = line.text.match(/^(\s*)([a-zA-Z0-9\._-]+)\s*task:/);
        if (results !== null) {
            return { range: this.getRange(line), symbol: this.makeTokenFrom(results, 2, line.lineNumber), type: TaskType.Standard };
        }

        results = line.text.match(/^(\s*until\s*)([a-zA-Z0-9\._-]+)\s*performed/);
        if (results !== null) {
            return { range: this.getRange(line), symbol: this.makeTokenFrom(results, 2, line.lineNumber), type: TaskType.PersistUntil };
        }

        results = line.text.match(/^(\s*)([a-zA-Z0-9\._-]+)(\s*)([a-zA-Z0-9\._-]+)/);
        if (results !== null) {
            if (results[2] === "variable") {
                return { range: this.getRange(line), symbol: this.makeTokenFrom(results, 4, line.lineNumber), type: TaskType.Variable };
            } else if (this.builtinTypes.isTaskType(results[2])) {
                return { range: this.getRange(line), globalVarName: this.makeTokenFrom(results, 2, line.lineNumber), symbol: this.makeTokenFrom(results, 4, line.lineNumber), type: TaskType.GlobalVarLink };
            }
        }
    }

    /**
     * Parses a line as a leaf token. 
     * @param line  A text line.
     * @returns A quest token.
     */
    public parseToken(line: TextLine): QuestToken {
        const character: number = line.text.search(/[^\s]/);
        return new QuestToken(line.lineNumber, character !== -1 ? character : line.text.length, line.text.trim());
    }

    private getRange(line: TextLine): Range {
        const character: number = line.text.search(/[^\s]/);
        return character !== - 1 ?
            new Range(line.lineNumber, character, line.lineNumber, character + line.text.trim().length) :
            new Range(line.lineNumber, 0, line.lineNumber, 0);
    }

    private makeTokenFrom(results: RegExpMatchArray, resultIndex: number, line: number): QuestToken {
        let character = 0;
        for (let index = 1; index < resultIndex; index++) {
            const result = results[index];
            if (result !== undefined) {
                character += result.length;
            }
        }

        return new QuestToken(line, character, results[resultIndex]);
    }
}

/**
 * Parses a message block inside a quest file.
 */
export class MessageBlockParser {
    public constructor(private readonly document: TextDocument, private readonly messageNode: MessageNode) {
    }

    /**
     * Checks if this is the empty line at the end of the message block.
     * A message block ends when next line matches one of the following:
     * - End of file.
     * - Another empty line.
     * - A comment line.
     * - A line with `:`, like a message definition or `QBN` block (see [github.com/Interkarma/daggerfall-unity](https://github.com/Interkarma/daggerfall-unity/blob/a42ca59f8ee386b753c1bbbb67d842a8c991447e/Assets/Scripts/Game/Questing/Parser.cs#L260))
     * @param lineNumber The number of a line.
     * @returns True if this is the empty line that ends the message block.
     */
    public isEndOfBlock(lineNumber: number): boolean {
        if (lineNumber == this.document.lineCount - 1) {
            return true;
        }

        const line = this.document.lineAt(lineNumber);
        if (line.text.length === 0) {
            if (line.lineNumber < this.document.lineCount - 1) {
                const nextLine: TextLine = this.document.lineAt(lineNumber + 1);
                if (nextLine.text.length == 0 || nextLine.text.startsWith('-', nextLine.firstNonWhitespaceCharacterIndex) || nextLine.text.indexOf(':') !== -1) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Finds all symbols with any accepted prefix.
     * @param line A string to seek symbols within.
     */
    public parseBodyLine(lineNumber: number): void {
        const line: TextLine = this.document.lineAt(lineNumber);
        this.messageNode.bodyRange = this.messageNode.bodyRange.with(undefined, new Position(line.lineNumber, line.text.trimRight().length));
        this.messageNode.symbols = this.parseTokens(line, /(_{1,3}|={1,2})[a-zA-Z0-9_.-]+_/g, this.messageNode.symbols);
        this.messageNode.macros = this.parseTokens(line, /%[a-z0-9]+\b/g, this.messageNode.macros);
    }

    private parseTokens(line: TextLine, regExp: RegExp, tokens: QuestToken[] | undefined): QuestToken[] | undefined {
        let execArray: RegExpExecArray | null;
        while ((execArray = regExp.exec(line.text)) !== null) {
            if (tokens === undefined) {
                tokens = [];
            }

            tokens.push(new QuestToken(line.lineNumber, execArray.index, execArray[0]));
        }

        return tokens;
    }
}