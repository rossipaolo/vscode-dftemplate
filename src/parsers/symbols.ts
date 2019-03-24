/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { TextLine } from "vscode";

const definitionMatch = /^\s*(?:Person|Place|Item|Foe|Clock)\s*([a-zA-Z0-9._]+)/;

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
 * @example
 * `=symbol_` -> `symbol`
 * `symbol` -> `symbol`
 */
export function getSymbolName(symbol: string): string {
    return symbol.replace(/^_+/, '').replace(/^=+/, '').replace(/_$/, '');
}

/**
 * Makes a regexp that matches all occurrences of a symbol.
 * @param symbol An occurence of a symbol.
 */
export function makeSymbolRegex(symbol: string): RegExp {
    const name = getSymbolName(symbol);
    return new RegExp(name !== symbol ? '(_{1,4}|={1,2})' + name + '_' : name, 'g');
}

/**
 * Gets the name of the symbol defined in the given line.
 * @param line A quest line.
 */
export function getSymbolFromLine(line: TextLine): string | undefined {
    const result = definitionMatch.exec(line.text);
    if (result) {
        return result[1];
    }
}

/**
 * Checks if symbol is named as `_symbol_`.
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
 * Convert a symbol placeholder to its symbol type.
 * @param placeholder A placeholder for a symbol in a snippet.
 * @example 
 * `\${_clock_}` -> `Clock`
 */
export function symbolPlaceholderToType(placeholder: string) {
    placeholder = placeholder.replace('${_', '').replace('_}', '');
    return placeholder.substring(0, 1).toUpperCase().concat(placeholder.substring(1));
}