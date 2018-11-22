/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { Tables } from '../language/tables';
import { Modules } from '../language/modules';
import { Errors } from './common';
import { ParameterTypes } from '../language/parameterTypes';

export interface SignatureWord {
    regex: string;
    signature: string;
}

/**
* Detects issues with a signature.
* @param document A quest document.
* @param signature A snippet with standard syntax.
* @param line A quest line that is checked with the signature.
* @returns Diagnostics for the signature invocation.
*/
export function* doSignatureChecks(document: vscode.TextDocument, signature: string, line: vscode.TextLine): Iterable<vscode.Diagnostic> {
    const lineItems = line.text.trim().split(' ');
    let signatureItems = signature.replace(/\${\d:/g, '${').split(' ');
    signatureItems = doParams(signatureItems, lineItems);
    for (let i = 0; i < signatureItems.length && lineItems.length; i++) {
        const word = lineItems[i];
        const diagnostic = doWordCheck(document, word, signatureItems[i], () => {
            const wordPosition = findWordPosition(line.text, i);
            return new vscode.Range(line.lineNumber, wordPosition, line.lineNumber, wordPosition + word.length);
        });
        if (diagnostic) {
            yield diagnostic;
        }
    }
}

/**
* Detects issues with individual words in a signature.
* @param document A quest document.
* @param signatureWords Individual match words with standard syntax.
* @param line A quest line that is checked with the signature.
* @returns Diagnostics for the signature words.
*/
export function* doWordsCheck(document: vscode.TextDocument, signatureWords: SignatureWord[], line: vscode.TextLine): Iterable<vscode.Diagnostic> {
    for (const signatureWord of signatureWords) {
        const result = line.text.match(signatureWord.regex);
        if (result) {
            const diagnostic = doWordCheck(document, result[1], signatureWord.signature, () => {
                const wordPosition = line.text.indexOf(result[1]);
                return new vscode.Range(line.lineNumber, wordPosition, line.lineNumber, wordPosition + result[1].length);
            });
            if (diagnostic) {
                yield diagnostic;
            }
        }
    }
}

/**
* Gets an error message for a word in a line. Undefined if there are no issues.
* @param document A quest document.
* @param word A word inside an invocation.
* @param signatureItem A word in a signature that corresponds to `word`.
* @param range Gets range of word.
*/
function doWordCheck(document: vscode.TextDocument, word: string, signatureItem: string, range: () => vscode.Range): vscode.Diagnostic | undefined {
    switch (signatureItem) {
        case ParameterTypes.naturalNumber:
            if (isNaN(Number(word))) {
                return Errors.notANumber(range(), word);
            } else if (word.startsWith('+') || word.startsWith('-')) {
                return Errors.numberIsNotNatural(range(), word);
            }
            break;
        case ParameterTypes.integerNumber:
            if (isNaN(Number(word))) {
                return Errors.notANumber(range(), word);
            } else if (!word.startsWith('+') && !word.startsWith('-')) {
                return Errors.numberIsNotInteger(range(), word);
            }
            break;
        case ParameterTypes.time:
            const time = word.split(':');
            if (Number(time[0]) > 23 || Number(time[1]) > 59) {
                return Errors.incorrectTime(range(), word);
            }
            break;
        case ParameterTypes.message:
            if (!isNaN(Number(word))) {
                if (!parser.findMessageByIndex(document, word)) {
                    return Errors.undefinedMessage(range(), word);
                }
            }
            else {
                if (!parser.findMessageByName(document, word)) {
                    return Errors.undefinedMessage(range(), word);
                }
            }
            break;
        case ParameterTypes.messageName:
            if (!parser.findMessageByName(document, word)) {
                return Errors.undefinedMessage(range(), word);
            }
            break;
        case ParameterTypes.messageID:
            if (!parser.findMessageByIndex(document, word)) {
                return Errors.undefinedMessage(range(), word);
            }
            break;
        case ParameterTypes.symbol:
            if (!parser.findSymbolDefinition(document, word)) {
                return Errors.undefinedSymbol(range(), word);
            }
            break;
        case ParameterTypes.itemSymbol:
            return checkType(document, word, parser.Types.Item, range);
        case ParameterTypes.personSymbol:
            return checkType(document, word, parser.Types.Person, range);
        case ParameterTypes.placeSymbol:
            return checkType(document, word, parser.Types.Place, range);
        case ParameterTypes.clockSymbol:
            return checkType(document, word, parser.Types.Clock, range);
        case ParameterTypes.foeSymbol:
            return checkType(document, word, parser.Types.Foe, range);
        case ParameterTypes.task:
            if (!parser.findTaskDefinition(document, word)) {
                return Errors.undefinedTask(range(), word);
            }
            break;
        case ParameterTypes.effectKey:
            if (!Modules.getInstance().effectKeyExists(word)) {
                return Errors.undefinedAttribute(range(), word, signatureItem.replace('${', '').replace('}', ''));
            }
            break;
    }

    const attributes = Tables.getInstance().getValues(signatureItem);
    if (attributes && attributes.indexOf(word) === -1) {
        return Errors.undefinedAttribute(range(), word, signatureItem.replace('${', '').replace('}', ''));
    }
}

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

/**
 * Checks that a symbol is defined and is defined as the correct type.
 * @param document A quest document.
 * @param symbol A symbol referenced inside an invocation.
 * @param type The type of the symbol as requested by signature.
 */
function checkType(document: vscode.TextDocument, symbol: string, type: string, range: () => vscode.Range): vscode.Diagnostic | undefined {
    const definition = parser.findSymbolDefinition(document, symbol);
    if (!definition) {
        return Errors.undefinedSymbol(range(), symbol);
    }
    else if (definition.type !== type) {
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