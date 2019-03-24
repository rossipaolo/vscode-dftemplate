/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { TextDocument, Position, CompletionItem, CancellationToken } from 'vscode';
import { QuestResourceCategory, SymbolType } from '../language/static/common';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { Tables } from '../language/static/tables';
import { ParameterTypes } from '../language/static/parameterTypes';

export class TemplateCompletionItemProvider implements vscode.CompletionItemProvider {

    private static readonly signatureInfoCommand = { command: 'editor.action.triggerParameterHints', title: '' };

    private static taskQueries = (document: TextDocument) => [
        {
            kind: vscode.CompletionItemKind.Variable,
            result: parser.findAllVariables(document)
        },
        {
            kind: vscode.CompletionItemKind.Method,
            result: parser.findAllTasks(document)
        }
    ]

    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Thenable<CompletionItem[]> {
        return new Promise(function (resolve, reject) {
            const line = document.lineAt(position.line);
            const text = line.text.substring(0, position.character - 2).trim();
            const prefix = TemplateCompletionItemProvider.getPrefix(line.text, position.character);

            // Find %abc symbols
            if (line.text[position.character - 2] === '%') {
                const items: CompletionItem[] = [];
                for (const symbol of Language.getInstance().findSymbols('%' + prefix)) {
                    let item = new vscode.CompletionItem(symbol.details.signature, vscode.CompletionItemKind.Property);
                    item.detail = symbol.details.signature;
                    item.documentation = symbol.details.summary;
                    items.push(item);
                }
                return resolve(items);
            }


            const items: CompletionItem[] = [];

            const param = TemplateCompletionItemProvider.findParamSignature(line, prefix, text);
            if (param) {

                // Inside an invocation: suggests values according to parameter type
                switch (param) {
                    case ParameterTypes.questName:
                        return TemplateCompletionItemProvider.findQuestsCompletionItems(token).then((items) => {
                            return resolve(items);
                        }), () => reject();
                    case ParameterTypes.message:
                    case ParameterTypes.messageName:
                        for (const message of parser.findAllMessages(document)) {
                            if (message.symbol.startsWith(prefix)) {
                                const item = new CompletionItem(message.symbol, vscode.CompletionItemKind.Struct);
                                item.detail = message.line.text.trim();
                                items.push(item);
                            }
                        }
                        break;
                    case ParameterTypes.symbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, document, prefix);
                        break;
                    case ParameterTypes.clockSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, document, prefix, SymbolType.Clock);
                        break;
                    case ParameterTypes.foeSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, document, prefix, SymbolType.Foe);
                        break;
                    case ParameterTypes.itemSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, document, prefix, SymbolType.Item);
                        break;
                    case ParameterTypes.personSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, document, prefix, SymbolType.Person);
                        break;
                    case ParameterTypes.placeSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, document, prefix, SymbolType.Place);
                        break;
                    case ParameterTypes.task:
                        for (const definitionQuery of TemplateCompletionItemProvider.taskQueries(document)) {
                            for (const result of definitionQuery.result) {
                                const item = new vscode.CompletionItem(result.symbol, definitionQuery.kind);
                                item.detail = result.line.text;
                                items.push(item);
                            }
                        }
                        break;
                    case ParameterTypes.effectKey:
                        for (const effectKey of Modules.getInstance().getEffectKeys(prefix)) {
                            items.push(new vscode.CompletionItem(effectKey, vscode.CompletionItemKind.EnumMember));
                        }
                        break;
                    default:
                        TemplateCompletionItemProvider.doParamSuggestions(items, param);
                        break;
                }

            }
            else {

                // Empty string: suggests invocation of definition/action/condition
                if (text.length === 0) {
                    TemplateCompletionItemProvider.findSignatures(prefix, items);

                    if ('message'.startsWith(prefix.toLowerCase())) {
                        items.push(TemplateCompletionItemProvider.messageDefinition(document, position));
                    }
                }

                // Find all symbols defined in the quest
                for (const result of parser.findAllSymbolDefinitions(document)) {
                    const item = new vscode.CompletionItem(result.symbol, vscode.CompletionItemKind.Field);
                    item.detail = result.line.text;
                    items.push(item);
                }
            }

            return items.length > 0 ? resolve(items) : reject();
        });
    }

    private static findQuestsCompletionItems(token: CancellationToken): Thenable<CompletionItem[]> {
        return parser.findAllQuests(token).then((quests) => {
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
            let prettySignature = Language.prettySignature(languageItem.details.signature);
            let item = new vscode.CompletionItem(prettySignature, TemplateCompletionItemProvider.getCompletionItemKind(languageItem.category));
            item.insertText = new vscode.SnippetString(Language.getInstance().getSymbolSnippet(languageItem.details.signature));
            item.detail = prettySignature;
            item.documentation = new vscode.MarkdownString(languageItem.details.summary);
            item.command = TemplateCompletionItemProvider.signatureInfoCommand;
            items.push(item);
        }

        // Modules
        for (const result of Modules.getInstance().findActions(prefix)) {
            for (const overload of result.details.overloads) {
                let signature = Modules.prettySignature(overload);
                let item = new vscode.CompletionItem(signature, TemplateCompletionItemProvider.getCompletionItemKind(result.category));
                item.insertText = new vscode.SnippetString(overload);
                item.detail = result.moduleName + ' -> ' + signature;
                item.documentation = new vscode.MarkdownString(result.details.summary);
                item.command = TemplateCompletionItemProvider.signatureInfoCommand;
                items.push(item);
            }
        }
    }

    private static messageDefinition(document: TextDocument, position: Position): CompletionItem {
        const item = new vscode.CompletionItem('Message: id', TemplateCompletionItemProvider.getCompletionItemKind(QuestResourceCategory.Message));
        item.insertText = new vscode.SnippetString('Message:  ${1:' + parser.getMessageIdForPosition(document, position.line) + '}');
        item.detail = 'Message: id';
        item.documentation = 'An additional message block';
        return item;
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
        const actionResult = Modules.getInstance().findAction(line.text, match[1]);
        if (actionResult) {
            return Modules.getParameterAtPosition(actionResult, previousText.split(' ').length);
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

    private static doSymbolSuggestions(items: vscode.CompletionItem[], document: TextDocument, prefix: string, type?: string) {
        for (const symbol of parser.findAllSymbolDefinitions(document)) {
            const definition = symbol.line.text.trim();
            if ((!type || definition.startsWith(type)) && symbol.symbol.startsWith(prefix)) {
                const item = new CompletionItem(symbol.symbol, vscode.CompletionItemKind.Field);
                item.detail = definition;
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

    private static getCompletionItemKind(category: QuestResourceCategory): vscode.CompletionItemKind {
        switch (category) {
            case QuestResourceCategory.Keyword:
                return vscode.CompletionItemKind.Keyword;
            case QuestResourceCategory.Message:
                return vscode.CompletionItemKind.Struct;
            case QuestResourceCategory.Definition:
                return vscode.CompletionItemKind.Constructor;
            case QuestResourceCategory.GlobalVar:
                return vscode.CompletionItemKind.Property;
            case QuestResourceCategory.Action:
                return vscode.CompletionItemKind.Method;
            case QuestResourceCategory.Condition:
                return vscode.CompletionItemKind.Event;
            default:
                return vscode.CompletionItemKind.Text;
        }
    }
}