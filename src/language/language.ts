/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

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
    public load(context: ExtensionContext) {
        loadTable(context, 'tables/language.json').then((obj) => {
            if (Language.instance) {
                Language.instance.table = {
                    symbols: Language.objectToMap(obj.symbols),
                    keywords: Language.objectToMap(obj.keywords),
                    messages: Language.objectToMap(obj.messages),
                    definitions: Language.objectToMap(obj.definitions)
                };
            }
        }, () => vscode.window.showErrorMessage('Failed to import language table.'));
    }

    /**
     * Find an item with the given name.
     */
    public seekByName(name: string): LanguageItemResult | undefined {
        let symbol = this.findSymbol(name);
        if (symbol) {
            return { category: '', summary: symbol, signature: '', parameters: [] };
        }

        let keyword = Language.getInstance().findKeyword(name);
        if (keyword) {
            return Language.itemToResult(keyword, Language.ItemKind.Keyword);
        }

        let message = Language.getInstance().findMessage(name);
        if (message) {
            return Language.itemToResult(message, Language.ItemKind.Message);
        }

        let definition = Language.getInstance().findDefinition(name);
        if (definition) {
            return Language.itemToResult(definition, Language.ItemKind.Definition);
        }
    }

    /**
     * Retrieve all items whose start match the given string.
     */
    public *seekByPrefix(prefix: string): Iterable<LanguageItemResult> {
        for (const result of iterateAll(this.findKeywords(prefix), this.findMessages(prefix))) {
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

    /**
     * Detects issues and returns error messages.
     */
    public *doDiagnostics(document: vscode.TextDocument, line: string): Iterable<string> {
        let match = /^\s*([a-zA-Z]+)/g.exec(line);
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