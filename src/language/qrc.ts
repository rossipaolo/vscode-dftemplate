/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { TextLine, Range, Position } from 'vscode';
import { Tables } from './static/tables';
import { QuestBlockKind } from './common';
import { MessageBlockParser } from '../parser';
import { QuestBlock, Message, QuestParseContext } from './resources';

/**
 * The quest block that holds text messages used by QBN resources.
 */
export class Qrc extends QuestBlock {

    public readonly kind = QuestBlockKind.QRC;

    /**
     * Messages definitions in this QRC block.
     */
    public readonly messages: Message[] = [];

    /**
    * Parses a line in a QRC block.
    * @param document A quest document.
    * @param line A line in QRC block.
    */
    public parse(line: TextLine, context: QuestParseContext): void {
        if (context.currentMessageBlock !== undefined) {
            context.currentMessageBlock.parseBodyLine(line.lineNumber);
            return;
        }

        const message: Message | undefined = Message.parse(line, context.nodeParser, context.data.language);
        if (message !== undefined) {
            this.messages.push(message);
            context.currentMessageBlock = new MessageBlockParser(context.document, message.node);
            return;
        }

        if (context.currentMessageBlock) {
            context.currentMessageBlock = undefined;
        }

        this.failedParse.push(context.nodeParser.parseToken(line));
    }

    /**
     * Gets a message this QRC block.
     * @param arg A numeric id, text alias or range.
     * @param tables Imported language tables.
     */
    public getMessage(arg: string | Range, tables: Tables): Message | undefined {
        if (arg instanceof Range) {
            return this.messages.find(x => x.range.isEqual(arg));
        }

        let id: number | undefined = Number(arg);
        if (isNaN(id)) {
            id = tables.staticMessagesTable.messages.get(arg);
        }

        if (id) {
            return this.messages.find(x => x.id === id);
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
}