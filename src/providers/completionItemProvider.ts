/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Position, CompletionItem, CancellationToken } from 'vscode';
import { QuestResourceCategory, SymbolType, QuestResourceInfo } from '../language/static/common';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { LanguageData } from '../language/static/languageData';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Quests } from '../language/quests';
import { Quest } from '../language/quest';

export class TemplateCompletionItemProvider implements vscode.CompletionItemProvider {

    private static readonly signatureInfoCommand = { command: 'editor.action.triggerParameterHints', title: '' };

    public constructor(private readonly data: LanguageData, private readonly quests: Quests) {
    }

    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Promise<CompletionItem[] | undefined> {
        const line = document.lineAt(position.line);
        const text = line.text.substring(0, position.character - 2).trim();
        const prefix = TemplateCompletionItemProvider.getPrefix(line.text, position.character);

        if (Quests.isTable(document.uri)) {
            return TemplateCompletionItemProvider.tableCompletionItems(document, prefix);
        }

        const quest = this.quests.get(document);

        if (quest.preamble.range && quest.preamble.range.contains(position)) {
            return this.preambleCompletionItems(prefix);
        } else if (quest.qrc.range && quest.qrc.range.contains(position)) {
            return this.qrcCompletionItems(quest, position, line, prefix);
        } else if (quest.qbn.range && quest.qbn.range.contains(position)) {
            return this.qbnCompletionItems(quest, line, text, prefix, token);
        }
    }

    private preambleCompletionItems(prefix: string): CompletionItem[] {
        const items: CompletionItem[] = [];

        // Directives
        for (const directive of this.data.language.findDirectives(prefix)) {
            items.push(this.signatureCompletionItem(directive));
        }

        return items;
    }

    private qrcCompletionItems(quest: Quest, position: Position, line: vscode.TextLine, prefix: string): CompletionItem[] {
        const items: CompletionItem[] = [];

        if (line.text[position.character - 2] === '%') {
            // Context macros
            for (const symbol of this.data.language.findSymbols('%' + prefix)) {
                const item = new vscode.CompletionItem(symbol.details.signature, vscode.CompletionItemKind.Property);
                item.detail = symbol.details.signature;
                item.documentation = symbol.details.summary;
                items.push(item);
            }
        } else {
            // Symbols
            for (const symbol of quest.qbn.iterateSymbols()) {
                this.data.language.getSymbolVariations(symbol.name, symbol.type).forEach(variation => {
                    const item = new vscode.CompletionItem(variation.word, vscode.CompletionItemKind.Field);
                    item.detail = `${symbol.type} ${symbol.name}${symbol.node.pattern !== undefined ? ' ' + symbol.node.pattern.value : ''} (${variation.description})`;
                    items.push(item);
                });
            }

            // Messages
            if ('message'.startsWith(prefix.toLowerCase())) {
                const item = new vscode.CompletionItem('Message: id', TemplateCompletionItemProvider.getCompletionItemKind(QuestResourceCategory.Message));
                item.insertText = new vscode.SnippetString('Message:  ${1:' + quest.qrc.getAvailableId(position) + '}');
                item.detail = 'Message: id';
                item.documentation = 'An additional message block';
                items.push(item);
            }

            // Directives and static messages
            for (const directive of [
                ...this.data.language.findDirectives(prefix),
                ...this.data.language.findMessages(prefix)]) {
                items.push(this.signatureCompletionItem(directive));
            }
        }

        return items;
    }

    private async qbnCompletionItems(quest: Quest, line: vscode.TextLine, text: string, prefix: string, token: CancellationToken): Promise<CompletionItem[]> {
        const items: CompletionItem[] = [];

        const param = this.findParamSignature(line, prefix, text);
        if (param) {
            // Inside an invocation: suggests values according to parameter type
            switch (param) {
                case ParameterTypes.questName:
                    const upperCasePrefix = prefix.toUpperCase();
                    const quests = await this.quests.getAll(token);
                    quests.forEach(quest => {
                        const name = quest.getName();
                        if (name && name.toUpperCase().startsWith(upperCasePrefix)) {
                            const item = new CompletionItem(name, vscode.CompletionItemKind.Class);
                            item.detail = quest.preamble.getDisplayName() || name;
                            item.documentation = quest.makeDocumentation(undefined, true);
                            items.push(item);
                        }
                    });
                    break;
                case ParameterTypes.message:
                case ParameterTypes.messageName:
                case ParameterTypes.messageID:
                    if (param !== ParameterTypes.messageID) {
                        const regex = new RegExp(`^${prefix}`, 'i');
                        for (const message of quest.qrc.messages) {
                            if (message.alias && regex.test(message.alias)) {
                                const item = new CompletionItem(message.alias, vscode.CompletionItemKind.Struct);
                                item.detail = message.makePreview(quest.document.getText(message.node.bodyRange), true);
                                item.documentation = quest.makeDocumentation(message, true);
                                items.push(item);
                            }
                        }
                    }

                    if (param !== ParameterTypes.messageName) {
                        for (const message of quest.qrc.messages) {
                            const messageID = String(message.id);
                            if (messageID.startsWith(prefix)) {
                                const item = new CompletionItem(messageID, vscode.CompletionItemKind.Struct);
                                item.detail = message.makePreview(quest.document.getText(message.node.bodyRange), true);
                                item.documentation = quest.makeDocumentation(message, true);
                                items.push(item);
                            }
                        }
                    }
                    break;
                case ParameterTypes.symbol:
                    TemplateCompletionItemProvider.symbolCompletionItems(items, quest, prefix);
                    break;
                case ParameterTypes.clockSymbol:
                    TemplateCompletionItemProvider.symbolCompletionItems(items, quest, prefix, SymbolType.Clock);
                    break;
                case ParameterTypes.foeSymbol:
                    TemplateCompletionItemProvider.symbolCompletionItems(items, quest, prefix, SymbolType.Foe);
                    break;
                case ParameterTypes.itemSymbol:
                    TemplateCompletionItemProvider.symbolCompletionItems(items, quest, prefix, SymbolType.Item);
                    break;
                case ParameterTypes.personSymbol:
                    TemplateCompletionItemProvider.symbolCompletionItems(items, quest, prefix, SymbolType.Person);
                    break;
                case ParameterTypes.placeSymbol:
                    TemplateCompletionItemProvider.symbolCompletionItems(items, quest, prefix, SymbolType.Place);
                    break;
                case ParameterTypes.task:
                    for (const task of quest.qbn.iterateTasks()) {
                        const kind = task.isVariable ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Method;
                        const item = new vscode.CompletionItem(task.node.symbol.value, kind);
                        item.detail = quest.document.lineAt(task.range.start.line).text.trim();
                        item.documentation = quest.makeDocumentation(task, true);
                        items.push(item);
                    }
                    break;
                case ParameterTypes.effectKey:
                    for (const effectKey of this.data.modules.getEffectKeys(prefix)) {
                        items.push(new vscode.CompletionItem(effectKey, vscode.CompletionItemKind.EnumMember));
                    }
                    break;
                default:
                    const suggestions = this.data.tables.getValues(param);
                    if (suggestions) {
                        suggestions.forEach(suggestion => {
                            items.push(new vscode.CompletionItem(suggestion, vscode.CompletionItemKind.EnumMember));
                        });
                    }
                    break;
            }
        } else {
            // Actions/condition
            for (const result of this.data.modules.findActions(prefix)) {
                for (let index = 0; index < result.details.overloads.length; index++) {
                    const overload = result.details.overloads[index];
                    const signature = Modules.prettySignature(overload);
                    const item = new vscode.CompletionItem(signature, TemplateCompletionItemProvider.getCompletionItemKind(result.category));
                    item.insertText = new vscode.SnippetString(overload);
                    item.detail = result.moduleName + ' -> ' + signature;
                    item.documentation = new vscode.MarkdownString(result.getSummary(index));
                    item.command = TemplateCompletionItemProvider.signatureInfoCommand;
                    items.push(item);
                }
            }

            // Other signatures
            for (const resourceInfo of [
                ...this.data.language.findDirectives(prefix),
                ...this.data.language.findDefinitions(prefix),
                ...this.data.language.findGlobalVariables(prefix)]) {
                items.push(this.signatureCompletionItem(resourceInfo));
            }
        }

        return items;
    }

    private static tableCompletionItems(document: TextDocument, prefix: string): CompletionItem[] {
        if ('entry'.startsWith(prefix)) {
            const schema = Quests.getTableSchema(document);
            if (schema) {
                const snippet = schema.map((value, index) => `\${${index + 1}:${value}}`).join(', ');
                const completionItem = new CompletionItem('entry', vscode.CompletionItemKind.Snippet);
                completionItem.detail = schema.join(', ');
                completionItem.documentation = 'A new entry in this table following its schema.';
                completionItem.insertText = new vscode.SnippetString(snippet);
                completionItem.command = TemplateCompletionItemProvider.signatureInfoCommand;
                return [completionItem];
            }
        }

        return [];
    }

    private signatureCompletionItem(resourceInfo: QuestResourceInfo): CompletionItem {
        const prettySignature = Language.prettySignature(resourceInfo.details.signature);
        const item = new vscode.CompletionItem(prettySignature, TemplateCompletionItemProvider.getCompletionItemKind(resourceInfo.category));
        const snippet = resourceInfo.category === QuestResourceCategory.Definition ?
            this.data.language.getSymbolSnippet(resourceInfo.details.signature) :
            resourceInfo.details.signature;
        item.insertText = new vscode.SnippetString(snippet);
        item.detail = prettySignature;
        item.documentation = new vscode.MarkdownString(resourceInfo.details.summary);
        item.command = TemplateCompletionItemProvider.signatureInfoCommand;
        return item;
    }

    private static symbolCompletionItems(items: vscode.CompletionItem[], quest: Quest, prefix: string, type?: string) {
        for (const symbol of quest.qbn.iterateSymbols()) {
            if ((!type || symbol.type === type) && symbol.name.startsWith(prefix)) {
                const item = new CompletionItem(symbol.name, vscode.CompletionItemKind.Field);
                item.detail = `${symbol.type} ${symbol.name}${symbol.node.pattern !== undefined ? ' ' + symbol.node.pattern.value : ''}`;
                items.push(item);
            }
        }
    }

    private findParamSignature(line: vscode.TextLine, prefix: string, previousText: string): string | undefined {
        const match = line.text.match(/^\s*([a-zA-Z]+)\s+/);
        if (!match) {
            return;
        }

        // Definition
        const definition = this.data.language.findDefinition(match[1], line.text);
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
        const actionResult = this.data.modules.findAction(line.text, match[1]);
        if (actionResult) {
            return Modules.getParameterAtPosition(actionResult, previousText.split(' ').length);
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
            case QuestResourceCategory.Directive:
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