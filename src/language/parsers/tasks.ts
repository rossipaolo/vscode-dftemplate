/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextDocument, TextLine, Range } from "vscode";

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
export function* findTasksReferences(document: TextDocument, symbol: string, includeDeclaration: boolean = true): Iterable<TextLine> {
    const declaration = makeTaskRegex(symbol);
    for (const line of parser.findLines(document, new RegExp('\b' + symbol + '\b'))) {
        if (includeDeclaration || !declaration.test(line.text)) {
            yield line;
        }
    }
}

/**
 * Finds the definition of all tasks in a quest.
 * @param document A quest document.
 */
export function* findAllTasks(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const variable of parser.matchAllLines(document, /^\s*(?:([a-zA-Z0-9._]+)\s*task:|until\s*([a-zA-Z0-9._]+)\s*performed)/)) {
        yield variable;
    }
}

/**
 * Finds the definition of all variables in a quest. Variables are tasks wich are only set or unset.
 * @param document A quest document.
 */
export function* findAllVariables(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const variable of parser.matchAllLines(document, /^\s*variable\s*([a-zA-Z0-9._]+)/)) {
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

function makeTaskRegex(symbol: string) {
    return new RegExp('^\\s*(' + symbol + '\\s+task:|' + 'until\\s*' + symbol + '\\s*performed|variable\\s+' + symbol + ')');
}