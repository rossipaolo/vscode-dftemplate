/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from './parser';
import { TextDocument, TextLine } from "vscode";

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

export function* findAllMessages(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const match of parser.matchAllLines(document, /\s*([a-zA-Z]+):\s*\[\s*[0-9]+\s*\]/)) {
        yield match;
    }
    for (const match of parser.matchAllLines(document, /\s*Message:\s+([0-9]+)/)) {
        yield match;
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
