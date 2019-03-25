/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { Diagnostic, } from "vscode";
import { Errors, Warnings, Hints, findParameter } from './common';
import { wordRange } from '../parser';
import { Language } from '../language/static/language';
import { Tables } from '../language/static/tables';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Quest } from '../language/quest';

/**
 * Analyses the QRC section of a quest.
 * @param document The current open document.
 * @param context Diagnostic context for the current document.
 */
export function* analyseQrc(context: Quest): Iterable<Diagnostic> {

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
        const collisions = context.qrc.messages.filter(x => x.id === message.id);
        if (collisions.length > 1) {
            const allLocations = collisions.map(x => context.getLocation(x.range));
            yield Errors.duplicatedMessageNumber(message.range, message.id, allLocations);
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
    for (const line of context.qrc.iterateMessageLines()) {
        const symbols = parser.symbols.findAllSymbolsInALine(line.text);
        if (symbols) {
            for (const symbol of symbols) {
                let symbolDefinition = context.qbn.symbols.get(parser.symbols.getBaseSymbol(symbol));
                if (!symbolDefinition) {
                    yield Errors.undefinedSymbol(wordRange(line, symbol), symbol);
                } else {       
                    if (Array.isArray(symbolDefinition)) {
                        symbolDefinition = symbolDefinition[0];
                    }
                    
                    yield !Language.getInstance().isSymbolVariationDefined(symbol, symbolDefinition.type) ?
                        Warnings.incorrectSymbolVariation(wordRange(line, symbol), symbol, symbolDefinition.type) :
                        Hints.SymbolVariation(wordRange(line, symbol));
                }
            }
        }
    }

    // Macros
    for (const macro of context.qrc.macros) {
        if (!Language.getInstance().findSymbol(macro.symbol)) {
            yield Errors.undefinedContextMacro(macro.range, macro.symbol);
        }
    }

    for (const line of context.qrc.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'QRC');
    }
}

function messageHasReferences(context: Quest, messageID: number): boolean {
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