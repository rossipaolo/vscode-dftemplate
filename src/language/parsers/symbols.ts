/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextDocument, Location, Range, TextLine } from "vscode";

interface Symbol {
    type: string;
    location: Location;
}

export const enum Types {
    Item = 'Item',
    Person = 'Person',
    Place = 'Place',
    Clock = 'Clock',
    Foe = 'Foe'
}

const types: string[] = ['Item', 'Person', 'Place', 'Clock', 'Foe'];
//const definition = '\\s*(' + types.join('|') + ')\\s+';

/**
* Checks if a word is a symbol with any accepted prefix.
* @param word A word of text.
*/
export function isSymbol(word: string): boolean {
    return /(_{1,3}|={1,2})[a-zA-Z0-9_.-]+_/.test(word);
}

/**
 * Finds all symbols with any accepted prefix.
 * @param line A string to seek symbols within.
 */
export function findAllSymbolsInALine(line: string): RegExpMatchArray | null {
    return line.match(/(_{1,3}|={1,2})[a-zA-Z0-9_.-]+_/g);
}

/**
 * Remove prefixes from a derived symbol. 
 * @param derived An occurrence of a symbol.
 * @example 
 * `__symbol_` -> `_symbol_`
 * `=symbol_` -> `_symbol_`
 * `symbol` -> `symbol`
 */
export function getBaseSymbol(derived: string): string {
    return derived.replace(/^_+/, '_').replace(/^=+/, '_');
}

/**
 * Remove all prefixes and suffixes from a symbol.
 * @param symbol An occurence of a symbol.
 */
export function getSymbolName(symbol: string): string {
    return symbol.replace(/^_+/, '').replace(/^=+/, '').replace(/_$/, '');
}

/**
 * Check if derived is a variation of base.
 * @param base Base symbol (`_symbol_`).
 * @param derived An occurence of a symbol.
 */
export function isDerivedSymbol(base: string, derived: string): boolean {
    return new RegExp('(_{1,3}|={1,2})' + base.substring(1), 'g').test(derived);
}

/**
 * Check if this line is a symbol definition.
 * @param line A quest line.
 * @param base Base symbol (`_symbol_`).
 */
export function isSymbolDefinition(line: string, base: string): boolean {
    for (var i = 0; i < types.length; i++) {
        if (line.startsWith(types[i] + ' ' + base)) {
            return true;
        }
    }

    return false;
}

/**
 * Gets the name of the symbol defined in the given line.
 * @param line A quest line.
 */
export function getSymbolFromLine(line: TextLine): string | undefined {
    const result = /^\s*(?:Person|Place|Item|Foe|Clock)\s*([a-zA-Z0-9._]+)/.exec(line.text);
    if (result) {
        return result[1];
    }
}

/**
 * Checks if symbol is is named as `_symbol_`.
 * @param symbol A symbol name.
 */
export function symbolFollowsNamingConventions(symbol: string): boolean {
    return symbol.startsWith('_') && symbol.endsWith('_');
}

/**
 * Changes the name of a symbol to follow `_symbol_` convention.
 * @param symbol A symbol name.
 */
export function forceSymbolNamingConventions(symbol: string): string {
    if (!symbol.startsWith('_')) { symbol = '_' + symbol; }
    if (!symbol.endsWith('_')) { symbol += '_'; }
    return symbol;
}

/**
 * Find the definition of a symbol.
 * @param document A quest document.
 * @param symbol A symbol occurence.
 */
export function findSymbolDefinition(document: TextDocument, symbol: string): Symbol | undefined {
    symbol = getBaseSymbol(symbol);
    const text = document.getText();
    for (const type of types) {
        const seekedText = type + ' ' + symbol;
        const index = text.indexOf(seekedText);
        if (index !== -1) {
            return {
                location: new Location(document.uri, new Range(document.positionAt(index), document.positionAt(index + seekedText.length))),
                type: type
            };
        }
    }
}

/**
 * Find the definition of all symbols in a quest.
 * @param document A quest document.
 */
export function* findAllSymbolDefinitions(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const variable of parser.matchAllLines(document, /^\s*(?:Person|Place|Item|Foe)\s*([a-zA-Z0-9._]+)/)) {
        yield variable;
    }
}

/**
* Find all occurrences of a symbol with any prefix.
* @param text seek within this string.
* @param name base name of symbol without prefixes and suffixes. 
* @returns Location of symbol excluding prefixes and suffixes.
*/
export function* findSymbolReferences(document: TextDocument, symbolName: string, includeDeclaration: boolean = true): Iterable<Range> {
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const text = line.text;
        if (includeDeclaration || !isSymbolDefinition(text, '_' + symbolName + '_')) {
            for (let char = 0; char < line.text.length; char++) {
                if (text.substring(char, char + symbolName.length) === symbolName) {
                    if (text[char + symbolName.length] === '_' && (text[char - 1] === '_' || text[char - 1] === '=')) {
                        yield new Range(line.lineNumber, char, line.lineNumber, char + symbolName.length);
                    }
                }
            }
        }
    }
}