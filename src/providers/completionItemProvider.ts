/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

import { TextDocument, Position, CompletionItem } from 'vscode';
import { Modules } from '../language/modules';
import { Language } from '../language/language';
import { Tables } from '../language/tables';

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

    public provideCompletionItems(document: TextDocument, position: Position): Thenable<CompletionItem[]> {
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

            if (text.length === 0) {
                
                // Suggests invocation of definition/action/condition
                TemplateCompletionItemProvider.findSignatures(prefix, items);
            }
            else {

                // Suggests values for a parameter
                const param = TemplateCompletionItemProvider.findParamSignature(line, prefix, text);
                if (param) {
                    TemplateCompletionItemProvider.doParamSuggestions(items, param);
                }
            }

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

    private static findParamSignature(line: vscode.TextLine, prefix: string, previousText: string): string | undefined {
        const match = line.text.match(/^\s*([a-zA-Z]+)\s+/);
        if (!match) {
            return;
        }

        // Definition
        const definition = Language.getInstance().findDefinition(match[1], line.text);
        if (definition) {
            for (const signatureWord of definition.matches) {
                const result = line.text.match(signatureWord.regex);
                if (result && result[1] === prefix) {
                    return signatureWord.signature;
                }
            }

            return;
        }

        // Action/condition
        const actionResult = Modules.getInstance().findAction(match[1], line.text);
        if (actionResult) {
            const word = actionResult.action.overloads[actionResult.overload].split(' ')[previousText.split(' ').length];
            return word.replace(/\$\{\d:/, '${d:');
        }
    }

    private static doParamSuggestions(items: vscode.CompletionItem[], signatureWord: string) {
        const suggestions = Tables.getInstance().getValues(signatureWord);
        if (suggestions) {
            suggestions.forEach(suggestion => {
                items.push(new vscode.CompletionItem(suggestion, vscode.CompletionItemKind.EnumMember));
            });
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
            case Language.ItemKind.Definition:
                return vscode.CompletionItemKind.Constructor;
            case Modules.ActionKind.Action:
                return vscode.CompletionItemKind.Method;
            case Modules.ActionKind.Condition:
                return vscode.CompletionItemKind.Event;
            default:
                return vscode.CompletionItemKind.Text;
        }
    }
}