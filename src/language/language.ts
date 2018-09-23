/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

import { ExtensionContext } from 'vscode';
import { iterateAll, where, select, selectMany } from '../extension';
import { TablesManager } from "./base/tablesManager";
import { SignatureWord } from '../diagnostics/signatureCheck';
import { Tables } from './tables';

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
    symbolsVariations: Map<string, {
        word: string, description: string
    }[]>;
    keywords: Map<string, LanguageItem>;
    messages: Map<string, string>;
}

interface Definition {
    snippet: string;
    signature: string;
    match: string;
    matches: SignatureWord[];
    summary: string;
    parameters: Parameter[];
}

export interface LanguageItemResult extends LanguageItem {
    category: string;
}

/**
 * Manages tables with base language data for intellisense features.
 */
export class Language extends TablesManager {
    private table: LanguageTable | null = null;
    private definitions: Map<string, Definition[]> | null = null;

    private static instance: Language | null;

    public static readonly ItemKind = {
        Keyword: 'keyword',
        Message: 'message',
        Definition: 'definition',
        GlobalVar: 'globalVar'
    };

    /**
     * Load language tables.
     */
    public load(context: ExtensionContext): Promise<void> {
        const instance = this;
        return new Promise((resolve, reject) => {
            Promise.all([
                Language.loadTable(context, 'language.json').then((obj) => {
                    instance.table = {
                        symbols: Language.objectToMap(obj.symbols),
                        symbolsVariations: Language.objectToMap(obj.symbolsVariations),
                        keywords: Language.objectToMap(obj.keywords),
                        messages: Language.objectToMap(obj.messages),
                    };
                }, () => vscode.window.showErrorMessage('Failed to import language table.')),
                Language.loadTable(context, 'definitions.json').then((obj) => {
                    instance.definitions = Language.objectToMap(obj);
                })
            ]).then(() => {
                return resolve();
            }, () => reject());
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
            this.findGlobalVariables(prefix),
            this.findDefinitions(prefix))) {
            yield result;
        }
    }

    /**
     * Finds language items that starts with the given string (case insensitive) and returns their signature.
     */
    public *caseInsensitiveSeek(prefix: string): Iterable<string> {
        prefix = prefix.toUpperCase();
        if (this.table && this.definitions) {
            yield* select(where(this.table.keywords, x => x["1"].signature.toUpperCase().startsWith(prefix)), x => x["1"].signature);
            yield* selectMany(where(this.definitions, x => x["0"].toUpperCase().startsWith(prefix)), x => x["1"], x => x.snippet);
            yield* select(where(Tables.getInstance().globalVarsTable.globalVars, x => x["0"].toUpperCase().startsWith(prefix)), x => x["0"] + ' ${1:_varSymbol_}');
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
        const id = Tables.getInstance().staticMessagesTable.messages.get(name);
        if (id && this.table) {
            return Language.makeMessageItem(this.table, id, name);
        }
    }

    public findDefinition(name: string, text: string): Definition | undefined {
        if (this.definitions) {
            const group = this.definitions.get(name);
            if (group) {
                for (const definition of group) {
                    const regex = definition.match ? new RegExp('^\\s*' + definition.match + '\\s*$') :
                        Language.makeRegexFromSignature(definition.snippet);
                    if (!definition.signature) {
                        definition.signature = Language.prettySignature(definition.snippet);
                    }
                    if (regex.test(text)) {
                        return definition;
                    }
                }
            }
        }
    }

    public findGlobalVariable(name: string): number | undefined {
        return Tables.getInstance().globalVarsTable.globalVars.get(name);
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
        if (this.table) {
            for (const message of Tables.getInstance().staticMessagesTable.messages) {
                if (message["0"].startsWith(prefix)) {
                    yield Language.itemToResult(Language.makeMessageItem(this.table, message["1"], message["0"]), Language.ItemKind.Message);
                }
            }
        }
    }

    public *findGlobalVariables(prefix: string): Iterable<LanguageItemResult> {
        for (const globalVar of Tables.getInstance().globalVarsTable.globalVars) {
            if (globalVar["0"].startsWith(prefix)) {
                yield {
                    category: Language.ItemKind.GlobalVar, summary: 'Global variable number ' + globalVar["1"] + '.',
                    signature: globalVar["0"] + ' ${1:_varSymbol_}', parameters: []
                };
            }
        }
    }

    public *findDefinitions(prefix: string): Iterable<LanguageItemResult> {
        if (this.definitions) {
            for (const definition of this.definitions) {
                if (definition["0"].startsWith(prefix)) {
                    for (const signature of definition["1"]) {
                        yield {
                            category: 'definition', summary: signature.summary,
                            signature: signature.snippet, parameters: signature.parameters
                        };
                    }
                }
            }
        }
    }

    /**
     * Gets all supported variation schemas of a symbol type.
     * @param type A symbol type.
     */
    public getSymbolVariations(type: string) {
        if (this.table && this.table.symbolsVariations) {
            return this.table.symbolsVariations.get(type);
        }
    }

    /**
     * Gets the number of overloads for a symbol type.
     * @param symbolType A symbol type.
     */
    public numberOfOverloads(symbolType: string): number {
        if (this.definitions) {
            const def = this.definitions.get(symbolType);
            if (def) {
                return def.length;
            }
        }

        return 0;
    }

    public getOverloads(symbolType: string): Definition[] {
        if (this.definitions) {
            const def = this.definitions.get(symbolType);
            if (def) {
                return def;
            }
        }

        return [];
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

    private static loadTable(context: ExtensionContext, location: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const tablePath = path.join(context.extensionPath, 'tables', location);
            Language.parseFromJson(tablePath).then((obj) => {
                return resolve(obj);
            }, () => reject('Failed to load ' + location));
        });
    }

    private static objectToMap<T>(obj: any): Map<string, T> {
        const map = new Map<string, T>();
        for (let k of Object.keys(obj)) {
            map.set(k, obj[k]);
        }
        return map;
    }

    private static makeMessageItem(table: LanguageTable, id: number, name: string): LanguageItem {
        return {
            summary: table.messages.get(String(id)) || '',
            signature: name + ':   [' + id + ']',
            parameters: []
        };
    }
}