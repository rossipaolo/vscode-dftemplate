/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

import { ExtensionContext, TextDocument, Position, CompletionItem } from 'vscode';
import { loadTable } from '../extension';
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
            result: parser.findAllSymbolDefinitions(document)
        },
        {
            kind: vscode.CompletionItemKind.Variable,
            result: parser.findAllVariables(document)
        },
        {
            kind: vscode.CompletionItemKind.Method,
            result: parser.findAllTasks(document)
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
            if (parser.isQuestInvocation(document.lineAt(position.line).text)) {
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

    private static findQuestsCompletionItems(): Thenable<CompletionItem[]> {
        return parser.findAllQuests().then((quests) => {
            return quests.map((quest): CompletionItem => {
                const item = new CompletionItem(quest.pattern, vscode.CompletionItemKind.Class);
                item.detail = quest.displayName;
                return item;
            });
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