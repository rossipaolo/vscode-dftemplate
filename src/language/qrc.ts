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
    
    private textBlock: TextLine[] | undefined;
    private messageBlock: parser.MessageBlock | null = null;

    /**
    * Parses a line in a QRC block and builds its diagnostic context.
    * @param document A quest document.
    * @param line A line in QRC block.
    */
    public parse(document: TextDocument, line: TextLine): void {

        // Inside a message block
        if (this.textBlock && this.messageBlock && this.messageBlock.isInside(line.lineNumber)) {
            this.textBlock.push(line);
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

    /**
     * Iterates all text lines inside all message blocks.
     */
    public *iterateMessageLines(): Iterable<TextLine> {
        for (const message of this.messages) {
            yield* message.textBlock;
        }
    }

    private registerMessage(id: number, line: TextLine, alias?: string): void {
        const range = wordRange(line, String(id));
        const message = new Message(id, range, alias);
        this.messages.push(message);
        this.textBlock = message.textBlock;
    }
}