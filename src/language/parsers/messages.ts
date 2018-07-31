/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextDocument, TextLine, Range } from "vscode";

/**
 * Gets the index of the additional message defined in the given line.
 * @param line A quest line.
 */
export function getMessageIDFromLine(line: TextLine): string | undefined {
    const result = /^\s*Message:\s+([0-9]+)/.exec(line.text);
    if (result) {
        return result[1];
    }
}

/**
 * Find the definition of a message from its index.
 * @param document A quest document.
 * @param id The numeric index of a message.
 */
export function findMessageByIndex(document: TextDocument, id: string): { line: TextLine, isDefault: boolean } | undefined {
    // Default message
    let line = parser.findLine(document, new RegExp('\\[\\s*' + id + '\\s*\\]', 'g'));
    if (line) {
        return { line: line, isDefault: true };
    }

    // Additional message
    line = parser.findLine(document, new RegExp('^\\bMessage:\\s+' + id + '\\b', 'g'));
    if (line) {
        return { line: line, isDefault: false };
    }
}

/**
 * Find the definition of a message from its name. Only default messages have a name.
 * @param document A quest document.
 * @param name The name of a message.
 */
export function findMessageByName(document: TextDocument, name: string): TextLine | undefined {
    return parser.findLine(document, new RegExp('\\s*' + name + '\\s*:\\s*\\[\\s*\\d+\\s*\\]', 'g'));
}

export function* findAllMessages(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const match of parser.matchAllLines(document, /\s*([a-zA-Z]+):\s*\[\s*[0-9]+\s*\]/)) {
        yield match;
    }
    for (const match of parser.matchAllLines(document, /\s*Message:\s+([0-9]+)/)) {
        yield match;
    }
}

/**
 * Finds the first index which is not already used by a message.
 * @param document A quest document.
 * @param id The first index to start seeking.
 */
export function nextAvailableMessageID(document: TextDocument, id: string): string {
    let messageID = Number(id);
    while (parser.findMessageByIndex(document, String(messageID))) {
        messageID++;
    }
    return String(messageID);
}

/**
 * Gets the range where the entire task block is found.
 * @param document A quest document.
 * @param definitionLine The line where the task is defined.
 */
export function getMessageRange(document: TextDocument, definitionLine: number): Range {
    let line = definitionLine;
    while (++line < document.lineCount && !/^\s*(\s*(-.*)?|.*\[\s*([0-9]+)\s*\]|Message:\s*([0-9]+))\s*$/.test(document.lineAt(line).text)) {}
    return new Range(definitionLine, 0, --line, document.lineAt(line).text.length);
}