/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { ExtensionContext, TextDocument, Position, CompletionItem } from 'vscode';
import { loadTable } from '../extension';
import { Parser } from '../language/parser';
import { Modules } from '../language/modules';
import { Language } from '../language/language';

class AttributeItem {
    public attribute: string = '';
    public values: string[] = [];
}

export class TemplateCompletionItemProvider implements vscode.CompletionItemProvider {

    private static definitionQueries = (document: TextDocument) => [
        {
            kind: vscode.CompletionItemKind.Field,
            result: Parser.findAllSymbolsDefinedInQuest(document)
        },
        {
            kind: vscode.CompletionItemKind.Variable,
            result: Parser.findAllVariablesDefinedInQuest(document)
        },
        {
            kind: vscode.CompletionItemKind.Method,
            result: Parser.findAllTasksDefinedInQuest(document)
        }
    ]

    private attributes: AttributeItem[] = [];

    constructor(context: ExtensionContext) {
        loadTable(context, 'tables/attributes.json').then((obj) => {
            this.attributes = obj;
        });
    }

    public provideCompletionItems(document: TextDocument, position: Position): Thenable<CompletionItem[]> {
        let instance: TemplateCompletionItemProvider = this;
        return new Promise(function (resolve, reject) {
            const line = document.lineAt(position.line);
            const text = line.text.substring(0, position.character - 2).trim();
            const prefix = TemplateCompletionItemProvider.getPrefix(line.text, position.character);

            // Find quests in the workspace
            if (Parser.isQuest(document.lineAt(position.line).text)) {
                return TemplateCompletionItemProvider.findQuestsCompletionItems().then((items) => {
                    return resolve(items);
                }), () => reject();
            }

            // Find attributes
            for (const attributeItem of instance.attributes) {
                if (text.endsWith(attributeItem.attribute)) {
                    return resolve(attributeItem.values.map((value, index, array) =>
                        new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember)));
                }
            }

            // Find %abc symbols
            if (line.text[position.character - 2] === '%') {
                const items: CompletionItem[] = [];
                for (const symbol of Language.getInstance().findSymbols('%' + prefix)) {
                    let item = new vscode.CompletionItem(symbol.signature, vscode.CompletionItemKind.Property);
                    item.detail = symbol.signature;
                    item.documentation = symbol.summary;
                    items.push(item);
                }
                return resolve(items);
            }


            const items: CompletionItem[] = [];

            // Find symbols and taks defined in the quest
            for (const definitionQuery of TemplateCompletionItemProvider.definitionQueries(document)) {
                for (const result of definitionQuery.result) {
                    const item = new vscode.CompletionItem(result.symbol, definitionQuery.kind);
                    item.detail = result.line.text;
                    items.push(item);
                }
            }

            // Seek signatures in language tables and imported modules
            TemplateCompletionItemProvider.findSignatures(prefix, items);

            return items.length > 0 ? resolve(items) : reject();
        });
    }

    private static findQuestsCompletionItems(): Promise<CompletionItem[]> {
        return new Promise((resolve, reject) => {
            return Parser.findLinesInAllfiles(Parser.questDefinitionPattern, true).then(results => {
                let items: CompletionItem[] = [];
                for (const result of results) {
                    let idLIne = Parser.findLine(result.document, Parser.questDefinitionPattern);
                    if (idLIne) {
                        let id = Parser.questDefinitionPattern.exec(idLIne.text);
                        if (id) {
                            let item = new CompletionItem(id[2], vscode.CompletionItemKind.Class);
                            let nameLine = Parser.findLine(result.document, Parser.displayNamePattern);
                            if (nameLine) {
                                let displayName = Parser.displayNamePattern.exec(nameLine.text);
                                if (displayName) {
                                    item.detail = displayName[1];
                                }
                            }
                            items.push(item);
                        }
                    }
                }

                return items.length > 0 ? resolve(items) : reject();
            }, () => { return reject(); });
        });
    }

    private static findSignatures(prefix: string, items: vscode.CompletionItem[]) {
        // Language
        for (const languageItem of Language.getInstance().seekByPrefix(prefix)) {
            let prettySignature = Language.prettySignature(languageItem.signature);
            let item = new vscode.CompletionItem(prettySignature, TemplateCompletionItemProvider.getCompletionItemKind(languageItem.category));
            item.insertText = new vscode.SnippetString(languageItem.signature);
            item.detail = prettySignature;
            item.documentation = languageItem.summary;
            items.push(item);
        }

        // Modules
        for (const result of Modules.getInstance().findActions(prefix)) {
            for (const overload of result.action.overloads) {
                let signature = Modules.prettySignature(overload);
                let item = new vscode.CompletionItem(signature, TemplateCompletionItemProvider.getCompletionItemKind(result.actionKind));
                item.insertText = new vscode.SnippetString(overload);
                item.detail = result.moduleName + ' -> ' + signature;
                item.documentation = result.action.summary;
                items.push(item);
            }
        }
    }

    private static getPrefix(text: string, position: number): string {
        let prefix = text.substring(position - 1);
        const i = prefix.indexOf(' ');
        if (i !== -1) {
            prefix = prefix.substring(0, i);
        }
        return prefix;
    }

    private static getCompletionItemKind(category: string): vscode.CompletionItemKind {
        switch (category) {
            case Language.ItemKind.Keyword:
                return vscode.CompletionItemKind.Keyword;
            case Language.ItemKind.Message:
                return vscode.CompletionItemKind.Struct;
            case Modules.ActionKind.Action:
                return vscode.CompletionItemKind.Method;
            case Modules.ActionKind.Condition:
                return vscode.CompletionItemKind.Event;
            default:
                return vscode.CompletionItemKind.Text;
        }
    }
}