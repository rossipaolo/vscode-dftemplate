/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

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
        // params: allows the last variable to be repeated
        if (/\${\d:\.\.\.[a-zA-Z0-9_-]+}$/.test(signature)) {
           signature = signature.substring(0, signature.lastIndexOf(' ')) + '(\\s+[a-zA-Z0-9_-]+)+';
        }

        signature = signature.replace(/\${\d\|/g, '(').replace(/\|}/g, ')').replace(/,/g, '|');     // ${d|a,b|} -> (a|b)
        signature = signature.replace(/\${\d:[a-zA-Z0-9_-]+?}/g, '[a-zA-Z0-9_-]+');                 // ${d:a}    -> [a-zA-Z0-9_-]+    
        return new RegExp('^\\s*' + signature + '\\s*$');
    }

    /**
     * Detects issues and returns error messages.
     */
    protected static *doDiagnostics(document: TextDocument, signature: string, line: string): Iterable<string> {
        const lineItems = line.trim().split(' ');
        let signatureItems = signature.replace(/\${\d:/g, '${d:').split(' ');
        signatureItems = TablesManager.doParams(signatureItems, lineItems);
        for (let i = 0; i < signatureItems.length && lineItems.length; i++) {
            const word = lineItems[i];
            switch (signatureItems[i]) {
                case '${d:dd}':
                    if (isNaN(Number(word))) {
                        yield Error.notANumber(word);
                    }
                    break;
                case '${d:hh}:${d:mm}':
                    const time = word.split(':');
                    if (Number(time[0]) > 23 || Number(time[1]) > 59) {
                        yield Error.incorrectTime(word);
                    }
                    break;
                case '${d:message}':
                    if (!isNaN(Number(word))) {
                        if (!parser.findMessageByIndex(document, word)) {
                            yield Error.undefinedMessage(word);
                        }
                    }
                    else {
                        if (!parser.findMessageByName(document, word)) {
                            yield Error.undefinedMessage(word);
                        }
                    }
                    break;
                case '${d:messageName}':
                    if (!parser.findMessageByName(document, word)) {
                        yield Error.undefinedMessage(word);
                    }
                    break;
                case '${d:messageID}':
                    if (!parser.findMessageByIndex(document, word)) {
                        yield Error.undefinedMessage(word);
                    }
                    break;
                case '${d:_symbol_}':
                    if (!parser.findSymbolDefinition(document, word)) {
                        yield Error.undefinedSymbol(word);
                    }
                    break;
                case '${d:_item_}':
                    const itemError = TablesManager.checkType(document, word, parser.Types.Item);
                    if (itemError) {
                        yield itemError;
                    }
                    break;
                case '${d:_person_}':
                    const personError = TablesManager.checkType(document, word, parser.Types.Person);
                    if (personError) {
                        yield personError;
                    }
                    break;
                case '${d:_place_}':
                    const placeError = TablesManager.checkType(document, word, parser.Types.Place);
                    if (placeError) {
                        yield placeError;
                    }
                    break;
                case '${d:_clock_}':
                    const clockError = TablesManager.checkType(document, word, parser.Types.Clock);
                    if (clockError) {
                        yield clockError;
                    }
                    break;
                case '${d:_foe_}':
                    const foeError = TablesManager.checkType(document, word, parser.Types.Foe);
                    if (foeError) {
                        yield foeError;
                    }
                    break;
                case '${d:task}':
                    if (!parser.findTaskDefinition(document, word)) {
                        yield Error.undefinedTask(word);
                    }
                    break;
                // case '${d:ww}:'
                // case '${d:questID}':
                // case '${d:questName}':
                //     break;
            }
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
}