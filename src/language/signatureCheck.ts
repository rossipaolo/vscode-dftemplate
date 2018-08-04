/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { Language } from './language';

export interface SignatureWord {
    regex: string;
    signature: string;
}

/**
 * Error messages shown in diagnostic hover.
 */
var Error = {
    notANumber: (word: string) => word + ' is not a number.',
    undefinedMessage: (message: string) => 'Reference to undefined message: ' + message + '.',
    undefinedSymbol: (symbol: string) => 'Reference to undefined symbol: ' + symbol + '.',
    undefinedTask: (symbol: string) => 'Reference to undefined task: ' + symbol + '.',
    undefinedAttribute: (name: string, group: string) =>  "The name '" + name + "' doesn't exist in the attribute group '" + group + "'.",
    incorrectTime: (time: string) => time + ' is not in 24-hour format (00:00 to 23:59).',
    incorrectSymbolType: (symbol: string, type: string) =>
        'Incorrect symbol type: ' + symbol + ' is not declared as ' + type + '.'
};

/**
* Detects issues with a signature.
* @param document A quest document.
* @param signature A snippet with standard syntax.
* @param line A quest line that is checked with the signature.
* @returns Diagnostics for the signature invocation.
*/
export function* doSignatureChecks(document: vscode.TextDocument, signature: string, line: vscode.TextLine): Iterable<vscode.Diagnostic> {
    const lineItems = line.text.trim().split(' ');
    let signatureItems = signature.replace(/\${\d:/g, '${d:').split(' ');
    signatureItems = doParams(signatureItems, lineItems);
    for (let i = 0; i < signatureItems.length && lineItems.length; i++) {
        const word = lineItems[i];
        const message = doWordCheck(document, word, signatureItems[i]);
        if (message) {
            const wordPosition = findWordPosition(line.text, i);
            const range = new vscode.Range(line.lineNumber, wordPosition, line.lineNumber, wordPosition + word.length);
            yield new vscode.Diagnostic(range, message);
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
            const message = doWordCheck(document, result[1], signatureWord.signature);
            if (message) {
                const wordPosition = line.text.indexOf(result[1]);
                const range = new vscode.Range(line.lineNumber, wordPosition, line.lineNumber, wordPosition + result[1].length);
                yield new vscode.Diagnostic(range, message);
            }
        }
    }
}

/**
* Gets an error message for a word in a line. Undefined if there are no issues.
* @param document A quest document.
* @param word A word inside an invocation.
* @param signatureItem A word in a signature that corresponds to `word`.
*/
function doWordCheck(document: vscode.TextDocument, word: string, signatureItem: string): string | undefined {
    switch (signatureItem) {
        case '${d:dd}':
            if (isNaN(Number(word))) {
                return Error.notANumber(word);
            }
            break;
        case '${d:hh}:${d:mm}':
            const time = word.split(':');
            if (Number(time[0]) > 23 || Number(time[1]) > 59) {
                return Error.incorrectTime(word);
            }
            break;
        case '${d:message}':
            if (!isNaN(Number(word))) {
                if (!parser.findMessageByIndex(document, word)) {
                    return Error.undefinedMessage(word);
                }
            }
            else {
                if (!parser.findMessageByName(document, word)) {
                    return Error.undefinedMessage(word);
                }
            }
            break;
        case '${d:messageName}':
            if (!parser.findMessageByName(document, word)) {
                return Error.undefinedMessage(word);
            }
            break;
        case '${d:messageID}':
            if (!parser.findMessageByIndex(document, word)) {
                return Error.undefinedMessage(word);
            }
            break;
        case '${d:_symbol_}':
            if (!parser.findSymbolDefinition(document, word)) {
                return Error.undefinedSymbol(word);
            }
            break;
        case '${d:_item_}':
            return checkType(document, word, parser.Types.Item);
        case '${d:_person_}':
            return checkType(document, word, parser.Types.Person);
        case '${d:_place_}':
            return checkType(document, word, parser.Types.Place);
        case '${d:_clock_}':
            return checkType(document, word, parser.Types.Clock);
        case '${d:_foe_}':
            return checkType(document, word, parser.Types.Foe);
        case '${d:task}':
            if (!parser.findTaskDefinition(document, word)) {
                return Error.undefinedTask(word);
            }
            break;
        case '${d:IndividualNPC}':
            if (!Language.getInstance().isIndividualNpc(word)) {
                return Error.undefinedAttribute(word, 'IndividualNPC');
            }
            break;
        case '${d:disease}':
            if (!Language.getInstance().isDisease(word)) {
                return Error.undefinedAttribute(word, 'disease');
            }
            break;
        case '${d:artifactItem}':
            if (!Language.getInstance().isArtifact(word)) {
                return Error.undefinedAttribute(word, 'artifact');
            }
            break;
        // case '${d:ww}:'
        // case '${d:questID}':
        // case '${d:questName}':
        // case '${d:commonItem}':
        // case '${d:foe}':
        //     break;
    }
}

function doParams(signatureItems: string[], lineItems: string[]): string[] {
    if (signatureItems[signatureItems.length - 1].indexOf('${d:...') !== -1) {
        const last = signatureItems[signatureItems.length - 1].replace('${d:...', '${d:');
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
function checkType(document: vscode.TextDocument, symbol: string, type: string): string | undefined {
    const definition = parser.findSymbolDefinition(document, symbol);
    if (!definition) {
        return Error.undefinedSymbol(symbol);
    }
    else if (definition.type !== type) {
        return Error.incorrectSymbolType(symbol, type);
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