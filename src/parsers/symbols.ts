/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from './parser';
import { TextDocument, Location, Range, TextLine, Position } from "vscode";
import { Language } from '../language/static/language';

export interface Symbol {
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

const definitionMatch = /^\s*(?:Person|Place|Item|Foe|Clock)\s*([a-zA-Z0-9._]+)/;

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
 * Checks if the symbol variation has a defined value for its type.
 * @param symbolOccurrence An occurence of a symbol.
 * @param type The type of the symbol.
 */
export function isSupportedSymbolVariation(symbolOccurrence: string, type: string): boolean {
    const variations = Language.getInstance().getSymbolVariations(type);
    const symbol = symbolOccurrence.replace(getSymbolName(symbolOccurrence), '$');
    return variations !== undefined && variations.findIndex(x => x.word === symbol) !== -1;
}

/**
 * Gets all supported variations of a symbol.
 * @param symbolOccurrence An occurence of a symbol.
 * @param type The type of the symbol.
 * @param formatName Format the name of the symbol used in description.
 */
export function getSupportedSymbolVariations(symbolOccurrence: string, type: string, formatName?: (name: string) => string) {
    const name = getSymbolName(symbolOccurrence);
    const variations = Language.getInstance().getSymbolVariations(type);
    return variations ? variations.map(x => {
        return { word: x.word.replace('$', name), description: x.description.replace('$', formatName ? formatName(name) : name) };
    }) : [];
}

/**
 * Check if this line is a symbol definition.
 * @param text A quest line.
 * @param base Base symbol (`_symbol_`).
 */
export function isSymbolDefinition(text: string, base: string): boolean {
    const result = text.match(definitionMatch);
    return result !== null && result[1] === base;
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
    const line = parser.firstLine(document, l => isSymbolDefinition(l.text, symbol));
    if (line) {
        const index = line.text.indexOf(symbol);
        if (index !== -1) {
            return {
                location: new Location(document.uri, new Range(new Position(line.lineNumber, index), new Position(line.lineNumber, index + symbol.length))),
                type: line.text.substring(0, index).trim()
            };
        }
    }
}

/**
 * Find the definition of all symbols in a quest.
 * @param document A quest document.
 */
export function* findAllSymbolDefinitions(document: TextDocument): Iterable<{ line: TextLine, symbol: string }> {
    for (const variable of parser.matchAllLines(document, definitionMatch)) {
        yield variable;
    }
}