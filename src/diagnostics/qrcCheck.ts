/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { Diagnostic, TextLine, TextDocument } from "vscode";
import { Errors, Warnings, Hints, wordRange } from './common';
import { Tables } from '../language/tables';
import { DiagnosticContext } from './diagnostics';
import { MessageBlock } from '../parsers/parser';

/**
 * Do diagnostics for a line in a QRC block.
 * @param document A quest document.
 * @param line A line in QRC block.
 * @param context Context data for current diagnostics operation. 
 */
export function* qrcCheck(document: TextDocument, line: TextLine, context: DiagnosticContext): Iterable<Diagnostic> {

    // Inside a message block
    if (context.messageBlock && context.messageBlock.isInside(line.lineNumber)) {
        return yield* messageBlockCheck(document, line);
    }

    // Static message definition 
    const staticMessage = parser.getStaticMessage(line.text);
    if (staticMessage) {
        const id = Tables.getInstance().staticMessagesTable.messages.get(staticMessage.name);
        if (!id || staticMessage.id !== id) {
            yield Errors.invalidStaticMessageDefinition(line.range, staticMessage.id, staticMessage.name);
        }
        else {

            yield* messageCommonCheck(context.messages, id, line);
        }

        context.messageBlock = new MessageBlock(document, line.lineNumber);
        return;
    }

    // Additional message definition
    const messageID = parser.getMessageIDFromLine(line);
    if (messageID) {
        const id = Number(messageID);

        yield* messageCommonCheck(context.messages, id, line);

        // Unused
        if (parser.findMessageReferences(document, messageID, false)[Symbol.iterator]().next().value === undefined) {
            yield Warnings.unusedDeclarationMessage(wordRange(line, messageID), messageID);
        }

        context.messageBlock = new MessageBlock(document, line.lineNumber);
        return;
    }

    // Undefined expression in qrc block
    if (context.messageBlock) {
        context.messageBlock = null;
    }
    yield Errors.undefinedExpression(parser.trimRange(line), 'QRC');
}

/**
 * Do diagnostics for a line in a message block.
 */
function* messageBlockCheck(document: TextDocument, line: TextLine): Iterable<Diagnostic> {

    // Symbol occurrences
    const symbols = parser.findAllSymbolsInALine(line.text);
    if (symbols) {
        for (const symbol of symbols) {
            const definition = parser.findSymbolDefinition(document, symbol);
            if (!definition) {
                yield Errors.undefinedSymbol(wordRange(line, symbol), symbol);
            }
            else if (!parser.isSupportedSymbolVariation(symbol, definition.type)) {
                yield Warnings.incorrectSymbolVariation(wordRange(line, symbol), symbol, definition.type);
            }
            else {
                yield Hints.SymbolVariation(wordRange(line, symbol));
            }
        }
    }
}

/**
 * Do diagnostics for message definitions which are valid for both static and additional messages.
 */
function* messageCommonCheck(messages: number[], id: number, line: TextLine): Iterable<Diagnostic> {

    // Incorrect position
    if (id < messages[messages.length - 1]) {
        yield Hints.incorrectMessagePosition(wordRange(line, String(id)), id, messages[messages.length - 1]);
    }

    // Duplicated definition
    if (messages.indexOf(id) !== -1) {
        yield Errors.duplicatedMessageNumber(wordRange(line, String(id)), id);
    }
    else {
        messages.push(id);
    }
}