/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { TextDocument, TextLine, Range, Location } from "vscode";
import { Modules } from '../language/modules';

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

export interface TaskDefinition {
    readonly symbol: string;
    readonly type: TaskType;
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
 * Finds a task defined in the given line.
 */
export function parseTaskDefinition(text: string): TaskDefinition | undefined {

    let match = text.match(/^\s*([a-zA-Z0-9\._-]+)\s*task:/);
    if (match) {
        return { symbol: match[1], type: TaskType.Standard};
    }

    match = text.match(/^\s*until\s*([a-zA-Z0-9\._-]+)\s*performed/);
    if (match) {
        return { symbol: match[1], type: TaskType.PersistUntil };
    }

    match = text.match(/^\s*variable\s*([a-zA-Z0-9\._-]+)/);
    if (match) {
        return { symbol: match[1], type: TaskType.Variable};
    }

    match = text.match(globalMatch);
    if (match) {
        return { globalVarName: match[1], symbol: match[2], type: TaskType.GlobalVarLink };
    }
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
    yield* parser.matchAllLines(document, /^\s*variable\s*([a-zA-Z0-9._]+)/);
    if (globalMatch) {
        yield* parser.matchAllLines(document, globalMatch, 2);
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