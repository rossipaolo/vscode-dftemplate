/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';
import { wordRange } from '../diagnostics/common';
import { TextLine, TextDocument } from 'vscode';
import { MessageBlock } from '../parsers/parser';
import { QuestBlock, Message } from './common';

/**
 * The quest block that holds text messages used by QBN resources.
 */
export class Qrc extends QuestBlock {

    /**
     * Messages definitions in this QRC block.
     */
    public readonly messages: Message[] = [];

    /**
     * Merged text lines from all messages.  
     */
    public readonly messageBlocks: TextLine[] = [];
    
    private messageBlock: parser.MessageBlock | null = null;

    /**
    * Parses a line in a QRC block and builds its diagnostic context.
    * @param document A quest document.
    * @param line A line in QRC block.
    */
    public parse(document: TextDocument, line: TextLine): void {

        // Inside a message block
        if (this.messageBlock && this.messageBlock.isInside(line.lineNumber)) {
            this.messageBlocks.push(line);
            return;
        }

        // Static message definition 
        const staticMessage = parser.getStaticMessage(line.text);
        if (staticMessage) {
            this.registerMessage(staticMessage.id, line, staticMessage.name);
            this.messageBlock = new MessageBlock(document, line.lineNumber);
            return;
        }

        // Additional message definition
        const messageID = parser.getMessageIDFromLine(line);
        if (messageID) {
            this.registerMessage(Number(messageID), line);
            this.messageBlock = new MessageBlock(document, line.lineNumber);
            return;
        }

        // Undefined expression in qrc block
        if (this.messageBlock) {
            this.messageBlock = null;
        }
        this.failedParse.push(line);
    }

    private registerMessage(id: number, line: TextLine, alias?: string): void {
        const range = wordRange(line, String(id));
        const message = this.messages.find(x => x.id === id);
        if (!message) {
            this.messages.push({
                id: id,
                alias: alias,
                range: range,
                otherRanges: undefined
            });
        } else {
            const otherRanges = message.otherRanges || (message.otherRanges = []);
            otherRanges.push(range);
        }
    }
}