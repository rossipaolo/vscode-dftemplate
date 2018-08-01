/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';

import { ExtensionContext } from 'vscode';
import { loadTable, iterateAll } from '../extension';
import { TablesManager } from "./base/tablesManager";

interface Parameter {
    name: string;
    description: string;
}

interface LanguageItem {
    summary: string;
    signature: string;
    parameters: Parameter[];
}

interface LanguageTable {
    symbols: Map<string, string>;
    keywords: Map<string, LanguageItem>;
    messages: Map<string, LanguageItem>;
    definitions: Map<string, LanguageItem>;
    globalVariables: Map<string, number>;
}

export interface LanguageItemResult extends LanguageItem {
    category: string;
}

/**
 * Manages tables with base language data for intellisense features.
 */
export class Language extends TablesManager {
    private table: LanguageTable | null = null;

    private static instance: Language | null;

    public static readonly ItemKind = {
        Keyword: 'keyword',
        Message: 'message',
        Definition: 'definition'
    };

    /**
     * Load language tables.
     */
    public load(context: ExtensionContext): Promise<void> {
        var instance = this;
        return new Promise((resolve) => {
            loadTable(context, 'tables/language.json').then((obj) => {
                instance.table = {
                    symbols: Language.objectToMap(obj.symbols),
                    keywords: Language.objectToMap(obj.keywords),
                    messages: Language.objectToMap(obj.messages),
                    definitions: Language.objectToMap(obj.definitions),
                    globalVariables: Language.objectToMap(obj.globalVariables)
                };

                parser.setGlobalVariables(instance.table.globalVariables);

                return resolve();
            }, () => vscode.window.showErrorMessage('Failed to import language table.'));
        });
    }

    /**
     * Find an item with the given name.
     */
    public seekByName(name: string): LanguageItemResult | undefined {
        let symbol = this.findSymbol(name);
        if (symbol) {
            return { category: '', summary: symbol, signature: '', parameters: [] };
        }

        let keyword = this.findKeyword(name);
        if (keyword) {
            return Language.itemToResult(keyword, Language.ItemKind.Keyword);
        }

        let message = this.findMessage(name);
        if (message) {
            return Language.itemToResult(message, Language.ItemKind.Message);
        }

        let definition = this.findDefinition(name);
        if (definition) {
            return Language.itemToResult(definition, Language.ItemKind.Definition);
        }

        const globalVar = this.findGlobalVariable(name);
        if (globalVar) {
            return { category: 'task', summary: 'Global variable number ' + globalVar + '.', signature: name, parameters: [] };
        }
    }

    /**
     * Retrieve all items whose start match the given string.
     */
    public *seekByPrefix(prefix: string): Iterable<LanguageItemResult> {
        for (const result of iterateAll(
            this.findKeywords(prefix),
            this.findMessages(prefix),
            this.findGlobalVariables(prefix))) {
            yield result;
        }
    }

    public findSymbol(name: string): string | undefined {
        if (this.table && this.table.symbols.has(name)) {
            return this.table.symbols.get(name);
        }
    }

    public findKeyword(name: string): LanguageItem | undefined {
        if (this.table && this.table.keywords.has(name)) {
            return this.table.keywords.get(name);
        }
    }

    public findMessage(name: string): LanguageItem | undefined {
        if (this.table && this.table.messages.has(name)) {
            return this.table.messages.get(name);
        }
    }

    public findDefinition(name: string): LanguageItem | undefined {
        if (this.table && this.table.definitions.has(name)) {
            return this.table.definitions.get(name);
        }
    }

    public findGlobalVariable(name: string): number | undefined {
        if (this.table && this.table.globalVariables) {
            return this.table.globalVariables.get(name);
        }
    }

    public *findSymbols(prefix: string): Iterable<LanguageItemResult> {
        if (this.table && this.table.symbols) {
            for (const symbol of this.table.symbols) {
                if (symbol["0"].startsWith(prefix)) {
                    yield { category: 'symbol', summary: symbol["1"], signature: symbol["0"], parameters: [] };
                }
            }
        }
    }

    public *findKeywords(prefix: string): Iterable<LanguageItemResult> {
        if (this.table && this.table.keywords) {
            for (const keyword of Language.filterItems(this.table.keywords, prefix)) {
                yield Language.itemToResult(keyword, Language.ItemKind.Keyword);
            }
        }
    }

    public *findMessages(prefix: string): Iterable<LanguageItemResult> {
        if (this.table && this.table.messages) {
            for (const message of Language.filterItems(this.table.messages, prefix)) {
                yield Language.itemToResult(message, Language.ItemKind.Message);
            }
        }
    }

    public *findGlobalVariables(prefix: string): Iterable<LanguageItemResult> {
        if (this.table && this.table.globalVariables) {
            for (const globalVar of this.table.globalVariables) {
                if (globalVar["0"].startsWith(prefix)) {
                    yield {
                        category: 'task', summary: 'Global variable number ' + globalVar["1"] + '.',
                        signature: globalVar["0"] + ' ${1:_varSymbol_}', parameters: []
                    };
                }
            }
        }
    }

    /**
     * Detects issues and returns error messages.
     */
    public *doDiagnostics(document: vscode.TextDocument, line: vscode.TextLine): Iterable<vscode.Diagnostic> {
        
        // Signatures
        let match = /^\s*([a-zA-Z]+)/g.exec(line.text);
        if (match) {
            const result = this.findKeyword(match[1]);
            if (result) {
                for (const error of Language.doDiagnostics(document, result.signature, line)) {
                    yield error;
                }
            }
        }
    }

    public static getInstance(): Language {
        return Language.instance ? Language.instance : Language.instance = new Language();
    }

    public static release() {
        Language.instance = null;
    }

    private static *filterItems(items: Map<string, LanguageItem>, prefix: string): Iterable<LanguageItem> {
        for (const item of items) {
            if (item["0"].startsWith(prefix)) {
                yield item["1"];
            }
        }
    }

    private static itemToResult(item: LanguageItem, category: string): LanguageItemResult {
        return {
            category: category,
            summary: item.summary,
            signature: item.signature,
            parameters: item.parameters
        };
    }

    private static objectToMap<T>(obj: any): Map<string, T> {
        const map = new Map<string, T>();
        for (let k of Object.keys(obj)) {
            map.set(k, obj[k]);
        }
        return map;
    }
}