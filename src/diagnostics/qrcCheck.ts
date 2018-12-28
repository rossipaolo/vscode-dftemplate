/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';
import * as common from './common';

import { Diagnostic, TextLine } from "vscode";
import { Errors, Warnings, Hints, wordRange, DiagnosticContext, findParameter } from './common';
import { Tables } from '../language/tables';
import { MessageBlock } from '../parsers/parser';
import { ParameterTypes } from '../language/parameterTypes';

/**
 * Parses a line in a QRC block and builds its diagnostic context.
 * @param document A quest document.
 * @param line A line in QRC block.
 * @param context Context data for current diagnostics operation. 
 */
export function parseQrc(line: TextLine, context: DiagnosticContext): void {

    // Inside a message block
    if (context.qrc.messageBlock && context.qrc.messageBlock.isInside(line.lineNumber)) {
        context.qrc.messageBlocks.push(line);
        return;
    }

    // Static message definition 
    const staticMessage = parser.getStaticMessage(line.text);
    if (staticMessage) {
        addMessageDefinition(context.qrc.messages, staticMessage.id, line, staticMessage.name);
        context.qrc.messageBlock = new MessageBlock(context.document, line.lineNumber);
        return;
    }

    // Additional message definition
    const messageID = parser.getMessageIDFromLine(line);
    if (messageID) {
        addMessageDefinition(context.qrc.messages, Number(messageID), line);
        context.qrc.messageBlock = new MessageBlock(context.document, line.lineNumber);
        return;
    }

    // Undefined expression in qrc block
    if (context.qrc.messageBlock) {
        context.qrc.messageBlock = null;
    }
    context.qrc.failedParse.push(line);
}

/**
 * Analyses the QRC section of a quest.
 * @param document The current open document.
 * @param context Diagnostic context for the current document.
 */
export function* analyseQrc(context: DiagnosticContext): Iterable<Diagnostic> {
    
    for (let index = 0; index < context.qrc.messages.length; index++) {
        const message = context.qrc.messages[index];

        // Unused
        if (!message.alias && !messageHasReferences(context, message.id)) {
            yield Warnings.unusedDeclarationMessage(message.range, String(message.id));
        }

        // Incorrect position
        if (index > 0 && message.id < context.qrc.messages[index - 1].id) {
            const previous = context.qrc.messages[index - 1];
            yield Hints.incorrectMessagePosition(message.range, message.id, previous.id, context.getLocation(previous.range));
        }

        // Duplicated definition
        if (message.otherRanges) {
            const allLocations = [message.range, ...message.otherRanges].map(x => context.getLocation(x));
            yield Errors.duplicatedMessageNumber(message.range, message.id, allLocations);
            for (const range of message.otherRanges) {
                yield Errors.duplicatedMessageNumber(range, message.id, allLocations);
            }
        }

        // Check or suggest alias
        if (message.alias) {
            const id = Tables.getInstance().staticMessagesTable.messages.get(message.alias);
            if (!id || message.id !== id) {
                yield Errors.invalidStaticMessageDefinition(message.range, message.id, message.alias);
            }
        } else {
            for (const staticMessage of Tables.getInstance().staticMessagesTable.messages) {
                if (staticMessage["1"] === message.id) {
                    yield Hints.useAliasForStaticMessage(message.range, message.id);
                    break;
                }
            }
        }
    }

    // Symbols inside message blocks
    for (const line of context.qrc.messageBlocks) {
        const symbols = parser.findAllSymbolsInALine(line.text);
        if (symbols) {
            for (const symbol of symbols) {
                let symbolDefinition = context.qbn.symbols.get(parser.getBaseSymbol(symbol));
                if (!symbolDefinition) {
                    yield Errors.undefinedSymbol(wordRange(line, symbol), symbol);
                } else {       
                    if (Array.isArray(symbolDefinition)) {
                        symbolDefinition = symbolDefinition[0];
                    }
                    
                    yield !parser.isSupportedSymbolVariation(symbol, symbolDefinition.type) ?
                        Warnings.incorrectSymbolVariation(wordRange(line, symbol), symbol, symbolDefinition.type) :
                        Hints.SymbolVariation(wordRange(line, symbol));
                }
            }
        }
    }

    for (const line of context.qrc.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'QRC');
    }
}

function addMessageDefinition(messages: common.MessageContext[], id: number, line: TextLine, alias?: string): void {
    const message = messages.find(x => x.id === id);
    if (!message) {
        messages.push({
            id: id,
            alias: alias,
            range: wordRange(line, String(id)),
            otherRanges: undefined
        });
    } else {
        const otherRanges = message.otherRanges || (message.otherRanges = []);
        otherRanges.push(wordRange(line, String(id)));
    }
}

function messageHasReferences(context: DiagnosticContext, messageID: number): boolean {
    // Numeric ID
    if (findParameter(context, parameter => (parameter.type === ParameterTypes.messageID || parameter.type === ParameterTypes.message) && parameter.value === String(messageID))) {
        return true;
    }

    // Text Alias
    for (const message of Tables.getInstance().staticMessagesTable.messages) {
        if (message[1] === messageID) {
            if (findParameter(context, parameter => (parameter.type === ParameterTypes.messageName || parameter.type === ParameterTypes.message) && parameter.value === message[0])) {
                return true;
            }
        }
    }

    return false;
}