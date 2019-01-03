/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { Tables } from '../language/static/tables';
import { Modules } from '../language/static/modules';
import { Errors } from './common';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Quest } from '../language/quest';

/**
 * A parameter in a symbol or action signature.
 */
export interface Parameter {
    type: string;
    value: string;
}

/**
* Analyses the definition of a symbol or action.
* @param context Context data for current diagnostics operation.
* @param line The line where the definition is found.
* @param signature Parameters of the symbol definition.
* @param areOrdered Are the parameters ordered?
* @returns Diagnostics for the signature words.
*/
export function* analyseSignature(context: Quest, line: vscode.TextLine, signature: Parameter[], areOrdered: boolean): Iterable<vscode.Diagnostic> {

    for (let index = 0; index < signature.length; index++) {
        const parameter = signature[index];

        const diagnostic = analyseParameter(context, parameter, () => {
            const wordPosition = areOrdered ? findWordPosition(line.text, index) : line.text.indexOf(parameter.value);
            return new vscode.Range(line.lineNumber, wordPosition, line.lineNumber, wordPosition + parameter.value.length);
        });

        if (diagnostic) {
            yield diagnostic;
        }
    }
}

/**
* Analyses a parameter in a symbol or action signature.
* @param document A quest document.
* @param parameter The parameter to analyse.
* @param range Gets range of word.
* @returns An error message for the parameter, undefined if there are no issues.
*/
function analyseParameter(context: Quest, parameter: Parameter, range: () => vscode.Range): vscode.Diagnostic | undefined {
    switch (parameter.type) {
        case ParameterTypes.naturalNumber:
            if (isNaN(Number(parameter.value))) {
                return Errors.notANumber(range(), parameter.value);
            } else if (parameter.value.startsWith('+') || parameter.value.startsWith('-')) {
                return Errors.numberIsNotNatural(range(), parameter.value);
            }
            break;
        case ParameterTypes.integerNumber:
            if (isNaN(Number(parameter.value))) {
                return Errors.notANumber(range(), parameter.value);
            } else if (!parameter.value.startsWith('+') && !parameter.value.startsWith('-')) {
                return Errors.numberIsNotInteger(range(), parameter.value);
            }
            break;
        case ParameterTypes.time:
            const time = parameter.value.split(':');
            if (Number(time[0]) > 23 || Number(time[1]) > 59) {
                return Errors.incorrectTime(range(), parameter.value);
            }
            break;
        case ParameterTypes.message:
            if (!isNaN(Number(parameter.value))) {
                if (!context.qrc.messages.find(x => x.id === Number(parameter.value))) {
                    return Errors.undefinedMessage(range(), parameter.value);
                }
            }
            else {
                const id = Tables.getInstance().staticMessagesTable.messages.get(parameter.value);
                if (!id || !context.qrc.messages.find(x => x.id === id)) {
                    return Errors.undefinedMessage(range(), parameter.value);
                }
            }
            break;
        case ParameterTypes.messageName:
            const id = Tables.getInstance().staticMessagesTable.messages.get(parameter.value);
            if (!id || !context.qrc.messages.find(x => x.id === Number(parameter.value))) {
                return Errors.undefinedMessage(range(), parameter.value);
            }
            break;
        case ParameterTypes.messageID:
            if (!context.qrc.messages.find(x => x.id === Number(parameter.value))) {
                return Errors.undefinedMessage(range(), parameter.value);
            }
            break;
        case ParameterTypes.symbol:
            if (!context.qbn.symbols.has(parameter.value)) {
                return Errors.undefinedSymbol(range(), parameter.value);
            }
            break;
        case ParameterTypes.itemSymbol:
            return checkType(context, parameter.value, parser.Types.Item, range);
        case ParameterTypes.personSymbol:
            return checkType(context, parameter.value, parser.Types.Person, range);
        case ParameterTypes.placeSymbol:
            return checkType(context, parameter.value, parser.Types.Place, range);
        case ParameterTypes.clockSymbol:
            return checkType(context, parameter.value, parser.Types.Clock, range);
        case ParameterTypes.foeSymbol:
            return checkType(context, parameter.value, parser.Types.Foe, range);
        case ParameterTypes.task:
            if (!context.qbn.tasks.has(parameter.value)) {
                return Errors.undefinedTask(range(), parameter.value);
            }
            break;
        case ParameterTypes.effectKey:
            if (!Modules.getInstance().effectKeyExists(parameter.value)) {
                return Errors.undefinedAttribute(range(), parameter.value, parameter.type.replace('${', '').replace('}', ''));
            }
            break;
    }

    const attributes = Tables.getInstance().getValues(parameter.type);
    if (attributes && attributes.indexOf(parameter.value) === -1) {
        return Errors.undefinedAttribute(range(), parameter.value, parameter.type.replace('${', '').replace('}', ''));
    }
}

/**
 * Checks that a symbol is defined and is defined as the correct type.
 * @param document A quest document.
 * @param symbol A symbol referenced inside an invocation.
 * @param type The type of the symbol as requested by signature.
 */
function checkType(context: Quest, symbol: string, type: string, range: () => vscode.Range): vscode.Diagnostic | undefined {
    const symbolContext = context.qbn.symbols.get(symbol);
    if (!symbolContext) {
        return Errors.undefinedSymbol(range(), symbol);
    }
    else if ((Array.isArray(symbolContext) ? symbolContext[0] : symbolContext).type !== type) {
        return Errors.incorrectSymbolType(range(), symbol, type);
    }
}

/**
* Finds the char index of a word in a string.
* For example wordIndex 2 in `give item _note_ to _vampleader_` is 5.
*/
function findWordPosition(text: string, wordIndex: number): number {
    let insideWord = false;
    for (let i = 0; i < text.length; i++) {
        if (text[i] !== ' ') {
            if (!insideWord) {
                if (wordIndex-- === 0) {
                    return i;
                }
                insideWord = true;
            }
        }
        else {
            if (insideWord) {
                insideWord = false;
            }
        }
    }

    return 0;
}