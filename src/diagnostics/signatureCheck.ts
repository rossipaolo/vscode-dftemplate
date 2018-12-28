/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { Tables } from '../language/tables';
import { Modules } from '../language/modules';
import { Errors, DiagnosticContext, ActionContext } from './common';
import { ParameterTypes } from '../language/parameterTypes';

export interface SignatureWord {
    regex: string;
    signature: string;
}

/**
 * A parameter in a symbol or action signature.
 */
export interface Parameter {
    type: string;
    value: string;
}

/**
 * Parses an action invocation and build its parameters array.
 * @param signature The signature of the action.
 * @param invocation The line of text that invokes the action.
 */
export function parseActionSignature(signature: string, invocation: string): Parameter[] {
    
    function doParams(signatureItems: string[], lineItems: string[]): string[] {
        if (signatureItems[signatureItems.length - 1].indexOf('${...') !== -1) {
            const last = signatureItems[signatureItems.length - 1].replace('${...', '${');
            signatureItems[signatureItems.length - 1] = last;
            if (lineItems.length > signatureItems.length) {
                signatureItems = signatureItems.concat(Array(lineItems.length - signatureItems.length).fill(last));
            }
        }
    
        return signatureItems;
    }
    
    const values = invocation.trim().split(' ');
    const types = doParams(signature.replace(/\${\d:/g, '${').split(' '), values);

    return values.map((value, index) => {
        return { type: types[index], value: value };
    });
}

/**
* Analyses an action invocation.
* @param context Context data for current diagnostics operation.
* @param action The action to analyse.
* @returns Diagnostics for the signature invocation.
*/
export function* analyseActionSignature(context: DiagnosticContext, action: ActionContext): Iterable<vscode.Diagnostic> {
    for (let i = 0; i < action.signature.length; i++) {
        const parameter = action.signature[i];
        const diagnostic = analyseParameter(context, parameter, () => {
            const wordPosition = findWordPosition(action.line.text, i);
            return new vscode.Range(action.line.lineNumber, wordPosition, action.line.lineNumber, wordPosition + parameter.value.length);
        });
        if (diagnostic) {
            yield diagnostic;
        }
    }
}

/**
 * Parses a symbol definition and build its parameters array.
 * @param signature RegExp that matches parameters.
 * @param invocation The line of text that defines the symbol.
 */
export function parseSymbolSignature(signature: SignatureWord[], invocation: string): Parameter[] {    
    return signature ? signature.reduce<Parameter[]>((parameters, word) => {
        const match = invocation.match(word.regex);
        if (match) {
            parameters.push({
                type: word.signature,
                value: match[1]
            });
        }

        return parameters;
    }, []) : [];
}

/**
* Analyses a symbol definition.
* @param context Context data for current diagnostics operation.
* @param signature Paramters of the symbol definition.
* @param line The line where the definition is found.
* @returns Diagnostics for the signature words.
*/
export function* analyseSymbolSignature(context: DiagnosticContext, signature: Parameter[], line: vscode.TextLine): Iterable<vscode.Diagnostic> {
    
    for (const parameter of signature) {
        const diagnostic = analyseParameter(context, parameter, () => {
            const wordPosition = line.text.indexOf(parameter.value);
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
function analyseParameter(context: DiagnosticContext, parameter: Parameter, range: () => vscode.Range): vscode.Diagnostic | undefined {
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
            context.qbn.referencedSymbols.add(parser.getBaseSymbol(parameter.value));
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
function checkType(context: DiagnosticContext, symbol: string, type: string, range: () => vscode.Range): vscode.Diagnostic | undefined {
    context.qbn.referencedSymbols.add(parser.getBaseSymbol(symbol));
    const symbolContext = context.qbn.symbols.get(symbol);
    if (!symbolContext) {
        return Errors.undefinedSymbol(range(), symbol);
    }
    else if ((Array.isArray(symbolContext) ? symbolContext[0] : symbolContext).definition.type !== type) {
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