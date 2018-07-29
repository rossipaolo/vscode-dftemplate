/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextDocument, TextLine } from "vscode";

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