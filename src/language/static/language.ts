/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as path from 'path';
import { iterateAll, where, select, selectMany, IContext } from '../../extension';
import { symbols } from '../../parser';
import { QuestResourceCategory, SymbolInfo, QuestResourceDetails, QuestResourceInfo, SymbolVariation, Overload } from './common';
import { StaticData } from "./staticData";
import { Tables } from './tables';

interface LanguageTable {
    symbols: Map<string, string>;
    symbolsVariations: Map<string, {
        word: string, description: string
    }[]>;
    directives: Map<string, QuestResourceDetails>;
    messages: Map<string, string>;
}

/**
 * Manages tables with base language data for intellisense features.
 */
export class Language extends StaticData {
    private table: LanguageTable | null = null;
    private definitions: Map<string, SymbolInfo[]> | null = null;

    /**
     * Symbols used inside QRC message blocks to be expanded depending on context.
     */
    public get contextMacros() : string[] {
        return this.table ? [...this.table.symbols.keys()] : [];
    }

    public constructor(private readonly tables: Tables) {
        super();
    }

    /**
     * Load language tables.
     */
    public async load(context: IContext): Promise<void> {
        const instance = this;

        const loadTable = async (name: string) =>
            await Language.parseFromJson(path.join(context.extensionPath, 'tables', name));

        await Promise.all([
            loadTable('language.json').then(obj => {
                instance.table = {
                    symbols: Language.objectToMap(obj.symbols),
                    symbolsVariations: Language.objectToMap(obj.symbolsVariations),
                    directives: Language.objectToMap(obj.directives),
                    messages: Language.objectToMap(obj.messages),
                };
            }),
            loadTable('definitions.json').then(obj => {
                instance.definitions = Language.objectToMap(obj);
            })
        ]);
    }

    /**
     * Find informations for a language resource with the given name.
     */
    public seekByName(name: string): QuestResourceInfo | undefined {

        const makeInfo = (
            category: QuestResourceCategory,
            details: QuestResourceDetails | undefined): QuestResourceInfo | undefined =>
            details !== undefined ? { category: category, details: details } : undefined;

        return makeInfo(QuestResourceCategory.Symbol, this.findSymbol(name)) ||
            makeInfo(QuestResourceCategory.Directive, this.findDirective(name)) ||
            makeInfo(QuestResourceCategory.Message, this.findMessage(name)) ||
            makeInfo(QuestResourceCategory.Task, this.findGlobalVariable(name));
    }

    /**
     * Retrieve all items whose start match the given string.
     */
    public *seekByPrefix(prefix: string): Iterable<QuestResourceInfo> {
        for (const result of iterateAll(
            this.findDirectives(prefix),
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
            yield* select(where(this.table.directives, x => x["1"].signature.toUpperCase().startsWith(prefix)), x => x["1"].signature);
            yield* selectMany(where(this.definitions, x => x["0"].toUpperCase().startsWith(prefix)), x => x["1"], x => x.snippet);
            yield* select(where(this.tables.globalVarsTable.globalVars, x => x["0"].toUpperCase().startsWith(prefix)), x => x["0"] + ' ${1:_varSymbol_}');
        }
    }

    public findSymbol(name: string): QuestResourceDetails | undefined {
        if (this.table && this.table.symbols.has(name)) {
            const symbol = this.table.symbols.get(name);
            if (symbol !== undefined) {
                return {
                    summary: symbol,
                    signature: ''
                };
            }
        }
    }

    public findDirective(name: string): QuestResourceDetails | undefined {
        if (this.table && this.table.directives.has(name)) {
            return this.table.directives.get(name);
        }
    }

    public findMessage(name: string): QuestResourceDetails | undefined {
        const id = this.tables.staticMessagesTable.messages.get(name);
        if (id && this.table) {
            return Language.makeMessageItem(this.table, id, name);
        }
    }

    public findDefinition(name: string, text: string): SymbolInfo | undefined {
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

    public findGlobalVariable(name: string): QuestResourceDetails | undefined {
        const id = this.tables.globalVarsTable.globalVars.get(name);
        if (id !== undefined) {
            return {
                summary: `Global variable number ${id}.`,
                signature: name
            };
        }
    }

    public *findSymbols(prefix: string): Iterable<QuestResourceInfo> {
        if (this.table && this.table.symbols) {
            for (const [signature, summary] of this.table.symbols) {
                if (signature.startsWith(prefix)) {
                    yield {
                        category: QuestResourceCategory.Symbol,
                        details: {
                            summary: summary, signature: signature
                        }
                    };
                }
            }
        }
    }

    public *findDirectives(prefix: string): Iterable<QuestResourceInfo> {
        if (this.table && this.table.directives) {
            for (const keyword of Language.filterItems(this.table.directives, prefix)) {
                yield {
                    category: QuestResourceCategory.Directive, details: keyword
                };
            }
        }
    }

    public *findMessages(prefix: string): Iterable<QuestResourceInfo> {
        if (this.table) {
            for (const [name, id] of this.tables.staticMessagesTable.messages) {
                if (name.startsWith(prefix)) {
                    yield {
                        category: QuestResourceCategory.Message,
                        details: Language.makeMessageItem(this.table, id, name)
                    };
                }
            }
        }
    }

    public *findGlobalVariables(prefix: string): Iterable<QuestResourceInfo> {
        for (const [alias, id] of this.tables.globalVarsTable.globalVars) {
            if (alias.startsWith(prefix)) {
                yield {
                    category: QuestResourceCategory.GlobalVar,
                    details: {
                        summary: 'Global variable number ' + id + '.',
                        signature: `${alias} \${1:_${alias.charAt(0).toLowerCase() + alias.slice(1)}_}`
                    }
                };
            }
        }
    }

    public *findDefinitions(prefix: string): Iterable<QuestResourceInfo> {
        if (this.definitions) {
            for (const [type, signatures] of this.definitions) {
                if (type.startsWith(prefix)) {
                    for (const signature of signatures) {
                        yield {
                            category: QuestResourceCategory.Definition,
                            details: signature
                        };
                    }
                }
            }
        }
    }

    public getSymbolSnippet(signature: string): string | undefined {
        if (this.definitions) {
            for (const [,symbol] of this.definitions) {
                for (const definition of symbol) {
                    if (definition.signature === signature) {
                        return definition.snippet;
                    }
                }
            }
        }
    }

    /**
     * Gets all supported variation schemas of a symbol type.
     * @param type A symbol type.
     * @param symbol The name of the symbol.
     * @param formatName Provide custom formatting for the description.
     */
    public getSymbolVariations(symbol: string, type: string, formatName?: (name: string) => string): SymbolVariation[] {
        if (this.table && this.table.symbolsVariations) {
            let variations = this.table.symbolsVariations.get(type);
            if (variations) {
                if (symbol) {
                    const name = symbols.getSymbolName(symbol);
                    variations = variations.map(x => {
                        return { word: x.word.replace('$', name), description: x.description.replace('$', formatName ? formatName(name) : name) };
                    });
                }

                return variations;
            }
        }

        return [];
    }

    /**
    * Checks if the symbol variation has a defined value for its type.
    * @param symbol An occurence of a symbol.
    * @param type The type of the symbol.
    */
    public isSymbolVariationDefined(symbol: string, type: string): boolean {
        return !!this.getSymbolVariations(symbol, type).find(x => x.word === symbol);
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

    /**
     * Finds a symbol definition used by a given invocation.
     * @param type A symbol type like `Person`.
     * @param invocation A line of code where a symbol is defined.
     */
    public matchSymbol(type: string, invocation: string): Overload<SymbolInfo> | undefined {
        if (this.definitions !== null) {
            const all = this.definitions.get(type);
            if (all !== undefined) {
                return {
                    all: all,
                    index: all.findIndex(symbol => {
                        const regex = symbol.match ?
                            new RegExp('^\\s*' + symbol.match + '\\s*$') :
                            Language.makeRegexFromSignature(symbol.snippet);
                        
                        return regex.test(invocation);
                    })
                };
            }
        }
    }

    private static *filterItems(items: Map<string, QuestResourceDetails>, prefix: string): Iterable<QuestResourceDetails> {
        for (const [name, detail] of items) {
            if (name.startsWith(prefix)) {
                yield detail;
            }
        }
    }

    private static objectToMap<T>(obj: any): Map<string, T> {
        const map = new Map<string, T>();
        for (let k of Object.keys(obj)) {
            map.set(k, obj[k]);
        }
        return map;
    }

    private static makeMessageItem(table: LanguageTable, id: number, name: string): QuestResourceDetails {
        return {
            summary: table.messages.get(String(id)) || '',
            signature: name + ':   [' + id + ']'
        };
    }
}