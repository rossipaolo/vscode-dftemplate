/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { TextDocument, TextLine, Range, Location } from "vscode";
import { iterateAll } from '../extension';
import { Modules } from '../language/modules';

let globalVarsAlternation: string;
let globalMatch: RegExp;

/**
 * Set known names and numbers of global variables used in the main quest.
 * @param globalVars A map of global variables.
 */
export function setGlobalVariables(globalVars: Map<string, number>) {
    const globalVariables = Array.from(globalVars.keys());
    globalVarsAlternation = globalVariables.join('|');
    globalMatch = new RegExp('^\\s*(' + globalVarsAlternation + ')\\s*([a-zA-Z0-9._]+)');
}

/**
 * Gets the name of the task defined in the given line.
 * @param line A quest line.
 */
export function getTaskName(text: string): string | undefined {
    const match = text.match(/^\s*variable\s*([a-zA-Z0-9._]+)/)
        || text.match(/^\s*([a-zA-Z0-9._]+)\s*task:/)
        || text.match(/^\s*until\s*([a-zA-Z0-9._]+)\s*performed/);
    if (match) { return match[1]; }
}

/**
 * Finds the definition of a task from it symbol.
 * @param document A quest document.
 * @param symbol The symbol of a task.
 */
export function findTaskDefinition(document: TextDocument, symbol: string): TextLine | undefined {
    return parser.findLine(document, makeTaskRegex(symbol));
}

/**
 * Finds all references to a task in a quest.
 * @param document A quest document.
 */
export function* findTasksReferences(document: TextDocument, symbol: string, includeDeclaration: boolean = true): Iterable<Range> {
    const declaration = makeTaskRegex(symbol);
    for (const line of parser.findLines(document, new RegExp('\\b' + symbol + '\\b'))) {
        if (includeDeclaration || !declaration.test(line.text)) {
            const index = line.text.indexOf(symbol);
            yield new Range(line.lineNumber, index, line.lineNumber, index + symbol.length);
        }
    }
}

/**
 * Finds the definition of all tasks in a quest.
 * @param document A quest document.
 */
export function* findAllTasks(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const variable of parser.matchAllLines(document, /^\s*(?:until\s*)?([a-zA-Z0-9._]+)\s*(?:task:|performed)/)) {
        yield variable;
    }
}

/**
 * Finds the definition of all variables in a quest. Variables are tasks wich are only set or unset.
 * @param document A quest document.
 */
export function* findAllVariables(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const variable of iterateAll(
        parser.matchAllLines(document, /^\s*variable\s*([a-zA-Z0-9._]+)/),
        parser.matchAllLines(document, globalMatch, 2))) {
        yield variable;
    }
}

/**
 * Gets the range where the entire task block is found.
 * @param document A quest document.
 * @param definitionLine The line where the task is defined.
 */
export function getTaskRange(document: TextDocument, definitionLine: number): Range {
    let line = definitionLine;
    while (++line < document.lineCount && !/^\s*(\s*(-.*)?|variable.*|.*task:|until.*performed)\s*$/.test(document.lineAt(line).text)) {}
    return new Range(definitionLine, 0, --line, document.lineAt(line).text.length);
}

export function getGlobalVariable(text: string): { name: string, symbol: string } | undefined {
    const match = text.match(globalMatch);
    if (match) {
        return { name: match[1], symbol: match[2] };
    }
}

/**
 * Finds all references to a global variable in all files.
 * @param name Name of global variable.
 */
export function findGlobalVarsReferences(name: string, token?: vscode.CancellationToken): Thenable<Location[]> {
    return parser.findReferences(name, globalMatch, token);
}

/**
 * Has this task one or more conditions?
 * @param document A quest document.
 * @param lineNumber The declaration line.
 */
export function isConditionalTask(document: TextDocument, lineNumber: number): boolean {
    if (document.lineCount > lineNumber + 1) {
        const text = document.lineAt(lineNumber + 1).text.trim();
        const space = text.indexOf(' ');
        if (space > 0) {
            const action = Modules.getInstance().findAction(text, text.substring(0, space));
            if (action && action.actionKind === Modules.ActionKind.Condition) {
                return true;
            }
        }
    }

    return false;
}

function makeTaskRegex(symbol: string) {
    return new RegExp('^\\s*(' + symbol + '\\s+task:|' + 'until\\s*' + symbol + '\\s*performed|' +
        '(variable|' + globalVarsAlternation + ')\\s+' + symbol + ')');
}