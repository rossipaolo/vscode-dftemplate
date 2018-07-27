/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { TextDocument } from "vscode";
import { Parser, Types } from '../parser';

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
        signature = signature.replace(/\${\d\|/g, '(').replace(/\|}/g, ')').replace(/,/g, '|'); // ${d|a,b|} -> (a|b)
        signature = signature.replace(/\${\d:[a-zA-Z0-9_]+?}/g, '[a-zA-Z0-9_-]+');              // ${d:a}    -> [a-zA-Z0-9_-]+
        return new RegExp('^\\s*' + signature + '\\s*$');
    }

    /**
     * Detects issues and returns error messages.
     */
    protected static *doDiagnostics(document: TextDocument, signature: string, line: string): Iterable<string> {
        const signatureItems = signature.replace(/\${\d:/g, '${d:').split(' ');
        const lineItems = line.trim().split(' ');
        for (let i = 0; i < signatureItems.length && i < lineItems.length; i++) {
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
                        if (!Parser.findMessageDefinition(document, word)) {
                            yield Error.undefinedMessage(word);
                        }
                    }
                    else {
                        if (!Parser.findDefaultMessageByName(document, word)) {
                            yield Error.undefinedMessage(word);
                        }
                    }
                    break;
                case '${d:messageName}':
                    if (!Parser.findDefaultMessageByName(document, word)) {
                        yield Error.undefinedMessage(word);
                    }
                    break;
                case '${d:messageID}':
                    if (!Parser.findMessageDefinition(document, word)) {
                        yield Error.undefinedMessage(word);
                    }
                    break;
                case '${d:_symbol_}':
                    if (!Parser.getSymbolType(document, word)) {
                        yield Error.undefinedSymbol(word);
                    }
                    break;
                case '${d:_item_}':
                    const itemError = TablesManager.checkType(document, word, Types.Item);
                    if (itemError) {
                        yield itemError;
                    }
                    break;
                case '${d:_person_}':
                    const personError = TablesManager.checkType(document, word, Types.Person);
                    if (personError) {
                        yield personError;
                    }
                    break;
                case '${d:_place_}':
                    const placeError = TablesManager.checkType(document, word, Types.Place);
                    if (placeError) {
                        yield placeError;
                    }
                    break;
                case '${d:_clock_}':
                    const clockError = TablesManager.checkType(document, word, Types.Clock);
                    if (clockError) {
                        yield clockError;
                    }
                    break;
                case '${d:_foe_}':
                    const foeError = TablesManager.checkType(document, word, Types.Foe);
                    if (foeError) {
                        yield foeError;
                    }
                    break;
                case '${d:task}':
                    if (!Parser.findTask(document, word)) {
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

    private static checkType(document: TextDocument, symbol: string, type: string): string | undefined {
        const actualType = Parser.getSymbolType(document, symbol);
        if (!actualType) {
            return Error.undefinedSymbol(symbol);
        }
        else if (actualType !== type) {
            return Error.incorrectSymbolType(symbol, type);
        }
    }
}