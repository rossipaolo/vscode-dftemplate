/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Position, CompletionItem, CancellationToken } from 'vscode';
import { QuestResourceCategory, SymbolType } from '../language/static/common';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { Tables } from '../language/static/tables';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Quest } from '../language/quest';

export class TemplateCompletionItemProvider implements vscode.CompletionItemProvider {

    private static readonly signatureInfoCommand = { command: 'editor.action.triggerParameterHints', title: '' };

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
            const quest = Quest.get(document);

            const param = TemplateCompletionItemProvider.findParamSignature(line, prefix, text);
            if (param) {

                // Inside an invocation: suggests values according to parameter type
                switch (param) {
                    case ParameterTypes.questName:
                        return TemplateCompletionItemProvider.findQuestsCompletionItems(prefix, token).then((items) => {
                            return resolve(items);
                        }), () => reject();
                    case ParameterTypes.message:
                    case ParameterTypes.messageName:
                        for (const message of quest.qrc.messages) {
                            if (message.alias && message.alias.startsWith(prefix)) {
                                const item = new CompletionItem(message.alias, vscode.CompletionItemKind.Struct);
                                item.detail = document.lineAt(message.range.start.line).text.trim();
                                items.push(item);
                            }
                        }
                        break;
                    case ParameterTypes.symbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, quest, prefix);
                        break;
                    case ParameterTypes.clockSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, quest, prefix, SymbolType.Clock);
                        break;
                    case ParameterTypes.foeSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, quest, prefix, SymbolType.Foe);
                        break;
                    case ParameterTypes.itemSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, quest, prefix, SymbolType.Item);
                        break;
                    case ParameterTypes.personSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, quest, prefix, SymbolType.Person);
                        break;
                    case ParameterTypes.placeSymbol:
                        TemplateCompletionItemProvider.doSymbolSuggestions(items, quest, prefix, SymbolType.Place);
                        break;
                    case ParameterTypes.task:
                        for (const task of quest.qbn.iterateTasks()) {
                            const kind = task.isVariable ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Method;
                            const item = new vscode.CompletionItem(task.definition.symbol, kind);
                            item.detail = document.lineAt(task.range.start.line).text.trim();
                            items.push(item);
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
                        items.push(TemplateCompletionItemProvider.messageDefinition(quest, position));
                    }
                }

                // Find all symbols defined in the quest
                for (const symbol of quest.qbn.iterateSymbols()) {
                    const item = new vscode.CompletionItem(symbol.name, vscode.CompletionItemKind.Field);
                    item.detail = symbol.line.text;
                    items.push(item);
                }
            }

            return items.length > 0 ? resolve(items) : reject();
        });
    }

    private static async findQuestsCompletionItems(prefix: string, token: CancellationToken): Promise<CompletionItem[]> {
        prefix = prefix.toUpperCase();
        const quests = await Quest.getAll(token);
        return quests.reduce((items, quest) => {
            const name = quest.getName();
            if (name && name.toUpperCase().startsWith(prefix)) {
                const item = new CompletionItem(name, vscode.CompletionItemKind.Class);
                item.detail = quest.preamble.getDisplayName() || name;
                items.push(item);
            }
            return items;
        }, new Array<CompletionItem>());
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

    private static messageDefinition(quest: Quest, position: Position): CompletionItem {
        const item = new vscode.CompletionItem('Message: id', TemplateCompletionItemProvider.getCompletionItemKind(QuestResourceCategory.Message));
        item.insertText = new vscode.SnippetString('Message:  ${1:' + quest.qrc.getAvailableId(position) + '}');
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

    private static doSymbolSuggestions(items: vscode.CompletionItem[], quest: Quest, prefix: string, type?: string) {
        for (const symbol of quest.qbn.iterateSymbols()) {
            if ((!type || symbol.type === type) && symbol.name.startsWith(prefix)) {
                const item = new CompletionItem(symbol.name, vscode.CompletionItemKind.Field);
                item.detail = symbol.line.text.trim();
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