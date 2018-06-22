/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { TextDocument, Position, Location, Range } from 'vscode';

export const enum Types {
    Item = 'Item',
    Person = 'Person',
    Place = 'Place',
    Clock = 'Clock',
    Foe = 'Foe'
}

/**
 * Provides common functionalities for parsing elements from a textDocument.
 */
export class Parser {

    private static types: string[] = ['Item', 'Person', 'Place', 'Clock', 'Foe'];

    /**
     * Get a word from the given position of a document.
     */
    public static getWord(document: TextDocument, position: Position): string | undefined {
        let range = document.getWordRangeAtPosition(position, /(={1,2}|%)?(\w|\d)+/g);
        if (range && !range.isEmpty) {
            return document.getText(range);
        }
    }

    /**
     * Find the definition of a symbol and return its location. Undefined if not found.
     */
    public static findDefinition(document: TextDocument, word: string): { location: Location, type: string } | undefined {
        word = this.getBaseSymbol(word);
        let text = document.getText();
        if (text) {
            for (var i = 0; i < this.types.length; i++) {
                let seekedText = this.types[i] + ' ' + word;
                let index = text.indexOf(seekedText);
                if (index !== -1) {
                    return {
                        location: new Location(document.uri, new Range(document.positionAt(index), document.positionAt(index + seekedText.length))),
                        type: this.types[i]
                    };
                }
            }
        }
    }

    /**
     * Find all occurrences of a symbol with any prefix.
     * 
     * @param text seek within this string.
     * @param name base name of symbol without prefixes and suffixes.
     * 
     * @returns Indices of names (after prefix).
     */
    public static *allSymbolOccurrences(text: string, name: string): Iterable<number> {
        for (let i = 0; i < text.length; ++i) {
            if (text.substring(i, i + name.length) === name) {
                if (text[i + name.length] === '_' && (text[i - 1] === '_' || text[i - 1] === '=')) {
                    yield i;
                }
            }
        }
    }

    /**
     * Check if a word is a symbol with any accepted prefix.
     */
    public static isSymbol(word: string): boolean {
        return new RegExp(/(_{1,3}|={1,2})\w+_/).test(word);
    }

    /**
     * Find all symbols with any accepted prefix.
     */
    public static findSymbols(line: string): RegExpMatchArray | null {
        return line.match(/(_{1,3}|={1,2})\w+_/g);
    }

    /**
     * Remove prefixes from a derived symbol.
     */
    public static getBaseSymbol(derived: string): string {
        return '_' + derived.replace(/^_+/, '').replace(/^=+/, '');
    }

    /**
     * Remove all prefixes and suffixes from a symbol.
     */
    public static getSymbolName(symbol: string): string {
        return symbol.replace(/^_+/, '').replace(/^=+/, '').replace(/_$/, '');
    }

    /**
     * Check if derived is a variation of base.
     */
    public static isDerived(base: string, derived: string): boolean {
        return new RegExp('(_{1,3}|={1,2})' + base.substring(1), 'g').test(derived);
    }

    /**
     * Check if this line is a symbol definition. 
     */
    public static isSymbolDefinition(line: string, base: string): boolean {
        for (var i = 0; i < this.types.length; i++) {
            if (line.startsWith(this.types[i] + ' ' + base)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if this line is a task definition.
     */
    public static isTask(line: string): boolean {
        return new RegExp(/(task|until\s+(\w|_|=)+\s+performed):\s*$/).test(line);
    }
}
