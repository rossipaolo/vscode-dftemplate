/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';
import * as common from './common';

import { Diagnostic, TextLine, TextDocument, Location } from "vscode";
import { Errors, Warnings, Hints, wordRange, DiagnosticContext } from './common';
import { Tables } from '../language/tables';
import { MessageBlock } from '../parsers/parser';
import { ParameterTypes } from '../language/parameterTypes';
import { Parameter } from './signatureCheck';

/**
 * Do diagnostics for a line in a QRC block.
 * @param document A quest document.
 * @param line A line in QRC block.
 * @param context Context data for current diagnostics operation. 
 */
export function* qrcCheck(document: TextDocument, line: TextLine, context: DiagnosticContext): Iterable<Diagnostic> {

    // Inside a message block
    if (context.qrc.messageBlock && context.qrc.messageBlock.isInside(line.lineNumber)) {
        return yield* messageBlockCheck(context, document, line);
    }

    // Static message definition 
    const staticMessage = parser.getStaticMessage(line.text);
    if (staticMessage) {
        addMessageDefinition(context.qrc.messages, staticMessage.id, line, staticMessage.name);
        context.qrc.messageBlock = new MessageBlock(document, line.lineNumber);
        return;
    }

    // Additional message definition
    const messageID = parser.getMessageIDFromLine(line);
    if (messageID) {
        addMessageDefinition(context.qrc.messages, Number(messageID), line);
        context.qrc.messageBlock = new MessageBlock(document, line.lineNumber);
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
            yield Hints.incorrectMessagePosition(message.range, message.id, previous.id, new Location(context.document.uri, previous.range));
        }

        // Duplicated definition
        if (message.otherRanges) {
            const allLocations = [message.range, ...message.otherRanges].map(x => new Location(context.document.uri, x));
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

    for (const line of context.qbn.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'QRC');
    }
}

/**
 * Do diagnostics for a line in a message block.
 */
function* messageBlockCheck(context: DiagnosticContext, document: TextDocument, line: TextLine): Iterable<Diagnostic> {

    // Symbol occurrences
    const symbols = parser.findAllSymbolsInALine(line.text);
    if (symbols) {
        for (const symbol of symbols) {
            const baseSymbol = parser.getBaseSymbol(symbol);
            context.qbn.referencedSymbols.add(baseSymbol);
            const symbolContext = common.getSymbolDefinition(context, document, baseSymbol);
            if (!symbolContext) {
                yield Errors.undefinedSymbol(wordRange(line, symbol), symbol);
            }
            else if (!parser.isSupportedSymbolVariation(symbol, symbolContext.definition.type)) {
                yield Warnings.incorrectSymbolVariation(wordRange(line, symbol), symbol, symbolContext.definition.type);
            }
            else {
                yield Hints.SymbolVariation(wordRange(line, symbol));
            }
        }
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

    /**
     * Checks if any symbol or action invocations has a parameter that matches `filter`.
     * @param filter A callback that filters the parameters.
     */
    function findParameter(filter: (parameter: Parameter) => boolean): boolean {
        for (const action of context.qbn.actions) {
            if (action[1].signature.find(x => filter(x))) {
                return true;
            }
        }

        for (const symbol of context.qbn.symbols.values()) {
            if (symbol) {
                const signature = Array.isArray(symbol) ? symbol[0].signature : symbol.signature;
                if (signature && signature.find(x => filter(x))) {
                    return true;
                }
            }
        }

        return false;
    }

    // Numeric ID
    if (findParameter(parameter => (parameter.type === ParameterTypes.messageID || parameter.type === ParameterTypes.message) && parameter.value === String(messageID))) {
        return true;
    }

    // Text Alias
    for (const message of Tables.getInstance().staticMessagesTable.messages) {
        if (message[1] === messageID) {
            if (findParameter(parameter => (parameter.type === ParameterTypes.messageName || parameter.type === ParameterTypes.message) && parameter.value === message[0])) {
                return true;
            }
        }
    }

    return false;
}