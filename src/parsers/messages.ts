/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from './parser';
import { TextDocument, TextLine, Range } from "vscode";
import { Language } from '../language/static/language';
import { Modules } from '../language/static/modules';
import { Tables } from '../language/static/tables';
import { ParameterTypes } from '../language/static/parameterTypes';

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

export function getStaticMessage(text: string) {
    const staticMessage = text.match(/^\s*(.*):\s+\[\s*([0-9]+)\s*\]\s*$/);
    if (staticMessage) {
        return { id: Number(staticMessage[2]), name: staticMessage[1] };
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
 * Finds all references to a message in a quest.
 * @param document A quest document.
 * @param idOrName Id or name of message.
 * @param includeDeclaration Include the position of the message declaration?
 */
export function* findMessageReferences(document: TextDocument, idOrName: string, includeDeclaration: boolean = true): Iterable<Range> {

    const isId = !isNaN(Number(idOrName));
    const declaration = isId ?
        new RegExp('^\\s*([a-zA-Z]+:\\s+\\[\\s*' + idOrName + '\\s*\\]|Message:\\s+' + idOrName + ')') :
        new RegExp('\\s*' + idOrName + '\\s*:\\s*\\[\\s*\\d+\\s*\\]');

    /**
     * Finds all references to a message id or one of its text aliases.
     * @param idOrName Message id or text alias.
     */
    function* findReferences(idOrName: string, isId: boolean, allowDeclaration: boolean): Iterable<Range> {
        for (const line of parser.findLines(document, new RegExp('\\b' + idOrName + '\\b'))) {

            if (declaration.test(line.text)) {
                if (allowDeclaration && includeDeclaration) {
                    yield parser.rangeOf(line, idOrName);
                }
    
                continue;
            }
    
            const firstWord = parser.getFirstWord(line.text);
            if (firstWord) {
    
                // Check this is a message for symbol definition
                const symbolDefinition = Language.getInstance().findDefinition(firstWord, line.text);
                if (symbolDefinition) {
                    if (symbolDefinition.matches.find(x => x.signature === ParameterTypes.message || (isId ? x.signature === ParameterTypes.messageID : x.signature === ParameterTypes.messageName))) {
                        yield parser.rangeOf(line, idOrName);
                    }

                    continue;
                }

                // Check this is a message for action invocation
                const actionInvocation = Modules.getInstance().findAction(line.text, firstWord);
                if (actionInvocation) {
                    if (Modules.actionHasParameterAtPosition(actionInvocation, Modules.getWordIndex(line.text, idOrName),
                        ParameterTypes.message, isId ? ParameterTypes.messageID : ParameterTypes.messageName)) {
                        yield parser.rangeOf(line, idOrName);
                    }

                    continue;
                }
            }
        }
    }

    // Find references to given word
    yield* findReferences(idOrName, isId, true);

    if (!isId) {
        // Find references to static message from its id
        const id = Tables.getInstance().staticMessagesTable.messages.get(idOrName);
        if (id) {
            yield* findReferences(String(id), true, false);
        }
    } else {
        // Find references to static message from its text aliases
        for (const alias of Tables.getInstance().staticMessagesTable.getAliases(Number(idOrName))) {
            yield* findReferences(alias, false, false);
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
 * Finds a message id which is not used and is bigger than the id of the previous message.
 * @param document A quest document.
 * @param lineNumber The line where the message ought to be positioned.
 */
export function getMessageIdForPosition(document: TextDocument, lineNumber: number): string {
    for (let index = lineNumber; index > 0; index--) {
        const line = document.lineAt(index);
        const match = line.text.match(/\s*Message:\s+([0-9]+)/);
        if (match) {
            return nextAvailableMessageID(document, String(Number(match[1]) + 1));
        }
    }

    return nextAvailableMessageID(document, '1011');
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
