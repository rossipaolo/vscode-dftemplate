/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextDocument, TextLine, Range } from "vscode";
import { Language } from '../language';
import { SignatureWords } from '../signatureCheck';
import { Modules } from '../modules';

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

/**
 * Finds all references to a message in a quest.
 * @param document A quest document.
 */
export function* findMessageReferences(document: TextDocument, idOrName: string, includeDeclaration: boolean = true): Iterable<Range> {

    const isId = !isNaN(Number(idOrName));
    const declaration = isId ?
        new RegExp('^\\s*([a-zA-Z]+\\s+\\[\\s*' + idOrName + '\\s*\\]|Message:\\s+' + idOrName + ')\\b') :
        new RegExp('\\s*' + idOrName + '\\s*:\\s*\\[\\s*\\d+\\s*\\]');

    for (const line of parser.findLines(document, new RegExp('\\b' + idOrName + '\\b'))) {
        if (includeDeclaration || !declaration.test(line.text)) {
            const firstWord = parser.getFirstWord(line.text);
            if (firstWord) {

                // Check this is a message for symbol definition
                const symbolDefinition = Language.getInstance().findDefinition(firstWord, line.text);
                if (symbolDefinition) {
                    if (symbolDefinition.matches.find(x => x.signature === SignatureWords.message || (isId ? x.signature === SignatureWords.messageID : x.signature === SignatureWords.messageName))) {
                        const index = line.text.indexOf(idOrName);
                        yield new Range(line.lineNumber, index, line.lineNumber, index + idOrName.length);
                    }

                    continue;
                }

                // Check this is a message for action invocation
                const actionInvocation = Modules.getInstance().findAction(firstWord, line.text);
                if (actionInvocation) {
                    if (Modules.actionHasParameters(actionInvocation, SignatureWords.message, isId ? SignatureWords.messageID : SignatureWords.messageName)) {
                        const index = line.text.indexOf(idOrName);
                        yield new Range(line.lineNumber, index, line.lineNumber, index + idOrName.length);
                    }

                    continue;
                }
            }
        }
    }
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
    let previousLineIsEmpty = false;
    while (++line < document.lineCount) {
        const text = document.lineAt(line).text;

        // Start of a new message block, comment or QBN
        if (/^\s*(\s*-.*|.*\[\s*([0-9]+)\s*\]|Message:\s*([0-9]+)|QBN:)\s*$/.test(text)) {
            break;
        }

        // Two empty lines
        const lineIsEmpty = /^\s*$/.test(text);
        if (lineIsEmpty && previousLineIsEmpty) {
            break;
        }

        previousLineIsEmpty = lineIsEmpty;
    }

    return new Range(definitionLine, 0, line - 2, document.lineAt(line).text.length);
}