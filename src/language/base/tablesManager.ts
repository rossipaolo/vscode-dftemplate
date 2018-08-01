/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { TextDocument } from "vscode";

/**
 * Error messages shown in diagnostic hover.
 */
var Error = {
    notANumber: (word: string) => word + ' is not a number.',
    undefinedMessage: (message: string) => 'Reference to undefined message: ' + message + '.',
    undefinedSymbol: (symbol: string) => 'Reference to undefined symbol: ' + symbol + '.',
    undefinedTask: (symbol: string) => 'Reference to undefined task: ' + symbol + '.',
    incorrectTime: (time: string) => time + ' is not in 24-hour format (00:00 to 23:59).',
    incorrectSymbolType: (symbol: string, type: string) => 
        'Incorrect symbol type: ' + symbol + ' is not declared as ' + type + '.'
};

let isIndividualNpc: (word: string) => boolean;
export function setIndividualNpcCallback(callback: (word: string) => boolean) {
    isIndividualNpc = callback;
}

/**
 * Manages tables with language data for intellisense features.
 */
export abstract class TablesManager {

    /**
     * Convert a snippet string to a pretty signature definition.
     */
    public static prettySignature(signature: string): string {
        return signature.replace(/\${\d(:|\|)?/g, '').replace(/\|?}/g, '');
    }

    /**
     * Convert a snippet string to a regular expression that matches the signature.
     */
    protected static makeRegexFromSignature(signature: string): RegExp {
        signature = signature.replace('+', '\\+');
        
        // params: allows the last variable to be repeated
        if (/\$\{\d:\.\.\.[a-zA-Z0-9_-]+\}$/.test(signature)) {
           signature = signature.substring(0, signature.lastIndexOf(' ')) + '(\\s+[a-zA-Z0-9_-]+)+';
        }

        
        signature = signature.replace(/\$\{\d\|/g, '(').replace(/\|\}/g, ')').replace(/,/g, '|');     // ${d|a,b|} -> (a|b)
        signature = signature.replace(/\$\{\d:[a-zA-Z0-9_-]+?\}/g, '[a-zA-Z0-9_-]+');                 // ${d:a}    -> [a-zA-Z0-9_-]+    
        return new RegExp('^\\s*' + signature + '\\s*$');
    }

    /**
     * Detects issues and returns error messages.
     */
    protected static *doDiagnostics(document: TextDocument, signature: string, line: vscode.TextLine): Iterable<vscode.Diagnostic> {
        const lineItems = line.text.trim().split(' ');
        let signatureItems = signature.replace(/\${\d:/g, '${d:').split(' ');
        signatureItems = TablesManager.doParams(signatureItems, lineItems);
        for (let i = 0; i < signatureItems.length && lineItems.length; i++) {
            const word = lineItems[i];
            const message = TablesManager.getErrorMessage(document, word, signatureItems[i]);
            if (message) {
                const wordPosition = TablesManager.findWordPosition(line.text, i);
                const range = new vscode.Range(line.lineNumber, wordPosition, line.lineNumber, wordPosition + word.length);
                yield new vscode.Diagnostic(range, message);
            }
        }
    }

    protected static parseFromJson(fullPath: string): Thenable<any> {
        return vscode.workspace.openTextDocument(fullPath).then((document) => {
            let obj = JSON.parse(document.getText());
            if (obj) {
                return obj;
            }
        }, () => console.log('Failed to parse ' + fullPath));
    }

    /**
     * Gets an error message for a word in a line. Undefined if there are no issues.
     */
    private static getErrorMessage(document:TextDocument, word: string, signatureItem: string): string | undefined {
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
                return TablesManager.checkType(document, word, parser.Types.Item);
            case '${d:_person_}':
                return TablesManager.checkType(document, word, parser.Types.Person);
            case '${d:_place_}':
                return TablesManager.checkType(document, word, parser.Types.Place);
            case '${d:_clock_}':
                return TablesManager.checkType(document, word, parser.Types.Clock);
            case '${d:_foe_}':
                return TablesManager.checkType(document, word, parser.Types.Foe);
            case '${d:task}':
                if (!parser.findTaskDefinition(document, word)) {
                    return Error.undefinedTask(word);
                }
                break;
            case '${d:IndividualNPC}':
                if (!isIndividualNpc(word)) {
                    return Error.undefinedSymbol(word);
                }
                break;
            // case '${d:ww}:'
            // case '${d:questID}':
            // case '${d:questName}':
            //     break;
        }
    }

    private static doParams(signatureItems: string[], lineItems: string[]): string[] {
        if (signatureItems[signatureItems.length - 1].indexOf('${d:...') !== -1) {
            const last = signatureItems[signatureItems.length - 1].replace('${d:...', '${d:');
            signatureItems[signatureItems.length - 1] = last;
            if (lineItems.length > signatureItems.length) {
                signatureItems = signatureItems.concat(Array(lineItems.length - signatureItems.length).fill(last));
            }
        }

        return signatureItems;
    }

    private static checkType(document: TextDocument, symbol: string, type: string): string | undefined {
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
     */
    private static findWordPosition(text: string, wordIndex: number): number {
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
}