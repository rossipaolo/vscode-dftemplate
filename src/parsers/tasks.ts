/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from './parser';
import { TextDocument, TextLine } from "vscode";

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
