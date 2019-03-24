/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';
import { wordRange } from '../diagnostics/common';
import { TextLine, TextDocument, Range, Position } from 'vscode';
import { MessageBlock } from '../parsers/parser';
import { QuestBlock, Message, ContextMacro } from './common';
import { Tables } from './static/tables';

/**
 * The quest block that holds text messages used by QBN resources.
 */
export class Qrc extends QuestBlock {

    /**
     * Messages definitions in this QRC block.
     */
    public readonly messages: Message[] = [];

    /**
     * Context macros used by messages.
     */
    public readonly macros: ContextMacro[] = [];

    private messageBlock: parser.MessageBlock | null = null;

    /**
    * Parses a line in a QRC block and builds its diagnostic context.
    * @param document A quest document.
    * @param line A line in QRC block.
    */
    public parse(document: TextDocument, line: TextLine): void {

        // Inside a message block
        if (this.messages.length > 0 && this.messageBlock && this.messageBlock.isInside(line.lineNumber)) {
            this.parseMessageLine(line);
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
     * Gets a message this QRC block.
     * @param arg A numeric id, text alias or range.
     */
    public getMessage(arg: string | Range): Message | undefined {
        if (arg instanceof Range) {
            return this.messages.find(x => x.range.isEqual(arg));
        }

        let id: number | undefined = Number(arg);
        if (isNaN(id)) {
            id = Tables.getInstance().staticMessagesTable.messages.get(arg);
        }

        if (id) {
            return this.messages.find(x => x.id === id);
        }
    }

    /**
     * Iterates all text lines inside all message blocks.
     */
    public *iterateMessageLines(): Iterable<TextLine> {
        for (const message of this.messages) {
            yield* message.textBlock;
        }
    }
    
    /**
     * Finds an available message id which is bigger or equal than the given id
     * or the id of the message above the given position.
     * @param minOrPos The minimum id or the position where the message is going to be placed.
     */
    public getAvailableId(minOrPos: number | Position): number {

        function getPrecedingId(messages: Message[], position: Position): number {
            let precedingMessage: Message | undefined;
            for (const message of messages.filter(x => x.range.start.isBefore(position))) {
                if (!precedingMessage || message.range.start.isAfter(precedingMessage.range.start)) {
                    precedingMessage = message;
                }
            }

            return precedingMessage ? precedingMessage.id + 1 : 1011;
        }

        let id = minOrPos instanceof Position ? getPrecedingId(this.messages, minOrPos) : minOrPos;
        while (this.messages.find(x => x.id === id)) {
            id++;
        }
        return id;
    }

    private registerMessage(id: number, line: TextLine, alias?: string): void {
        const range = wordRange(line, String(id));
        const message = new Message(id, range, alias);
        this.messages.push(message);
    }

    private parseMessageLine(line: TextLine): void {

        // Text
        this.messages[this.messages.length - 1].textBlock.push(line);

        // Macros
        const regex = /%[a-z0-9]+\b/g;
        let result: RegExpExecArray | null;
        while (result = regex.exec(line.text)) {
            this.macros.push({
                symbol: result[0],
                range: new Range(line.lineNumber, result.index, line.lineNumber, result.index + result[0].length)
            });
        }
    }
}