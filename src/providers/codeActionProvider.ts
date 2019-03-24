/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { CodeAction, CodeActionKind, DiagnosticSeverity, WorkspaceEdit } from 'vscode';
import { first } from '../extension';
import { Tables } from '../language/static/tables';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { StaticData } from '../language/static/staticData';
import { ParameterTypes } from '../language/static/parameterTypes';
import { QuestResource } from '../language/common';
import { Quest } from '../language/quest';
import { DiagnosticCode, wordRange } from '../diagnostics/common';
import { symbolPlaceholderToType } from '../parsers/parser';

export class TemplateCodeActionProvider implements vscode.CodeActionProvider {

    public constructor() {
        vscode.commands.registerCommand('dftemplate.insertSnippetAtRange', (snippet: string, range: vscode.Range) => {
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(snippet), range);
            }
        });
    }

    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext):
        Thenable<vscode.CodeAction[]> {

        return new Promise(resolve => {

            const quest = Quest.get(document);
            const actions: vscode.CodeAction[] = [];

            context.diagnostics.filter(x => range.intersection(x.range)).forEach(diagnostic => {
                let action: CodeAction | undefined;
                switch (diagnostic.code) {
                    case DiagnosticCode.DuplicatedMessageNumber:
                        const duplicatedMessage = quest.qrc.messages.find(x => x.range.isEqual(diagnostic.range));
                        if (duplicatedMessage) {
                            const newMessageID = quest.qrc.getAvailableId(duplicatedMessage.id);
                            action = new CodeAction(`Change ${duplicatedMessage.id} to ${newMessageID}`);
                            action.kind = CodeActionKind.QuickFix;
                            action.edit = new WorkspaceEdit();
                            action.edit.replace(document.uri, diagnostic.range, String(newMessageID));
                            actions.push(action);
                        }
                        break;
                    case DiagnosticCode.UnusedDeclarationMessage:
                        action = TemplateCodeActionProvider.removeUnusedResource(document, diagnostic, quest.qrc.messages);
                        if (action) {
                            actions.push(action);
                        }
                        break;
                    case DiagnosticCode.UnusedDeclarationSymbol:
                        action = TemplateCodeActionProvider.removeUnusedResource(document, diagnostic, quest.qbn.iterateSymbols());
                        if (action) {
                            actions.push(action);
                        }
                        break;
                    case DiagnosticCode.UnusedDeclarationTask:
                        action = TemplateCodeActionProvider.removeUnusedResource(document, diagnostic, quest.qbn.iterateTasks());
                        if (action) {
                            actions.push(action);
                        }
                        break;
                    case DiagnosticCode.UndefinedExpression:
                        const prefix = parser.getFirstWord((document.lineAt(diagnostic.range.start.line).text));
                        if (prefix) {
                            for (const signature of [
                                ...Language.getInstance().caseInsensitiveSeek(prefix),
                                ...Modules.getInstance().caseInsensitiveSeek(prefix)]) {
                                action = new CodeAction(`Change to '${StaticData.prettySignature(signature)}'`);
                                action.command = {
                                    title: action.title,
                                    command: 'dftemplate.insertSnippetAtRange',
                                    arguments: [signature, diagnostic.range]
                                };
                                actions.push(action);
                            }
                        }
                        break;
                    case DiagnosticCode.UndefinedStaticMessage:
                        const message = quest.qrc.getMessage(diagnostic.range);
                        if (message && message.alias) {
                            const aliasRange = wordRange(document.lineAt(diagnostic.range.start.line), message.alias);
                            for (const [name, id] of Tables.getInstance().staticMessagesTable.messages) {
                                if (id === message.id) {
                                    action = new CodeAction(`Change to '${name}'`, CodeActionKind.QuickFix);
                                    action.edit = new WorkspaceEdit();
                                    action.edit.replace(document.uri, aliasRange, name);
                                    actions.push(action);
                                }
                            }
                        }
                        break;
                    case DiagnosticCode.UndefinedMessage:
                        const messageParameter = quest.qbn.getParameter(diagnostic.range);
                        if (messageParameter) {
                            let messages: string[] = [];
                            if (messageParameter.type !== ParameterTypes.messageName) {
                                messages = messages.concat(quest.qrc.messages.map(x => String(x.id)));
                            }
                            if (messageParameter.type !== ParameterTypes.messageID) {
                                messages = messages.concat(quest.qrc.messages.filter(x => x.alias).map(x => x.alias) as string[]);
                            }

                            action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, messages);
                            if (action) {
                                actions.push(action);
                            }
                        }
                        break;
                    case DiagnosticCode.UndefinedContextMacro:
                        action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, Language.getInstance().contextMacros);
                        if (action) {
                            actions.push(action);
                        }
                        break;
                    case DiagnosticCode.UndefinedSymbol:
                        const symbolParameter = quest.qbn.getParameter(diagnostic.range);
                        if (symbolParameter) {
                            const symbolNames = Array.from(quest.qbn.iterateSymbols())
                                .filter(x => x.type === symbolPlaceholderToType(symbolParameter.type))
                                .map(x => x.name);
                            action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, symbolNames);
                        } else if (quest.qrc.range && quest.qrc.range.contains(diagnostic.range)) {
                            const symbol = document.getText(diagnostic.range);
                            const name = parser.getSymbolName(symbol);
                            const symbolNames = Array.from(quest.qbn.iterateSymbols())
                                .map(x => symbol.replace(name, parser.getSymbolName(x.name)));
                            action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, symbolNames);
                        }
                        if (action) {
                            actions.push(action);
                        }
                        break;
                    case DiagnosticCode.UndefinedTask:
                        const taskParameter = quest.qbn.getParameter(diagnostic.range);
                        if (taskParameter) {
                            const taskNames = Array.from(quest.qbn.iterateTasks()).map(x => x.definition.symbol);
                            action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, taskNames);
                            if (action) {
                                actions.push(action);
                            }
                        }
                        break;
                    case DiagnosticCode.UndefinedAttribute:
                        const parameter = quest.qbn.getParameter(diagnostic.range);
                        if (parameter) {
                            const values = Tables.getInstance().getValues(parameter.type);
                            if (values) {
                                action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, values);
                                if (action) {
                                    actions.push(action);
                                }
                            }
                        }
                        break;
                    case DiagnosticCode.ClockWithoutTask:
                        const clockName = document.getText(diagnostic.range);
                        const clockTaskPos = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
                        action = new CodeAction('Make clock task', CodeActionKind.QuickFix);   
                        action.edit = new WorkspaceEdit();
                        action.edit.insert(document.uri, clockTaskPos, `\n\n${clockName} task:`);
                        actions.push(action);
                        action = new CodeAction('Make clock variable', CodeActionKind.QuickFix);
                        action.edit = new WorkspaceEdit();
                        action.edit.insert(document.uri, clockTaskPos, `\n\nvariable ${clockName}`);
                        actions.push(action);
                        break;
                    case DiagnosticCode.IncorrectSymbolVariation:
                        const currentSymbol = document.getText(diagnostic.range);
                        const symbolDefinition = quest.qbn.getSymbol(currentSymbol);
                        if (symbolDefinition) {
                            Language.getInstance().getSymbolVariations(currentSymbol, symbolDefinition.type).forEach(newSymbol => {
                                const title = `Change ${currentSymbol} to ${newSymbol.word} (${newSymbol.description})`;
                                const action = new vscode.CodeAction(title);
                                action.kind = diagnostic.severity === DiagnosticSeverity.Hint ? CodeActionKind.Empty : CodeActionKind.QuickFix;
                                action.edit = new vscode.WorkspaceEdit();
                                action.edit.replace(document.uri, diagnostic.range, newSymbol.word);
                                actions.push(action);
                            });
                        }
                        break;
                    case DiagnosticCode.MissingPositiveSign:
                        action = new vscode.CodeAction(`Change to +${document.getText(diagnostic.range)}`, vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.insert(document.uri, diagnostic.range.start, '+');
                        actions.push(action);
                        break;
                    case DiagnosticCode.SymbolNamingConvention:
                        const symbol = document.getText(diagnostic.range);
                        const newName = parser.forceSymbolNamingConventions(symbol);
                        action = new CodeAction(`Rename ${symbol} to ${newName}`, CodeActionKind.QuickFix);
                        action.edit = new WorkspaceEdit();
                        action.edit.replace(document.uri, diagnostic.range, newName);
                        actions.push(action);
                        break;
                    case DiagnosticCode.UseAliasForStaticMessage:
                        const numericMessage = quest.qrc.messages.find(x => x.range.isEqual(diagnostic.range));
                        if (numericMessage) {
                            for (const [alias, id] of Tables.getInstance().staticMessagesTable.messages) {
                                if (id === numericMessage.id) {
                                    action = new CodeAction(`Convert ${numericMessage.id} to ${alias}`, CodeActionKind.QuickFix);
                                    action.edit = new WorkspaceEdit();
                                    action.edit.replace(document.uri, document.lineAt(numericMessage.range.start.line).range, `${alias}:   [${numericMessage.id}]`);
                                    actions.push(action);
                                }
                            }
                        }
                        break;
                }
            });

            return resolve(actions);
        });
    }

    private static removeUnusedResource(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, resources: Iterable<QuestResource>):
        CodeAction | undefined {
        const resource = first(resources, x => x.range.isEqual(diagnostic.range));
        if (resource) {
            const action = new CodeAction('Remove unused declaration');
            action.kind = CodeActionKind.QuickFix;
            action.edit = new WorkspaceEdit();
            action.edit.delete(document.uri, resource.blockRange);
            return action;
        }
    }

    private static bestMatch(document: vscode.TextDocument, range: vscode.Range, values: string[]): CodeAction {
        const stringSimilarity = require('string-similarity');
        const value = stringSimilarity.findBestMatch(document.getText(range), values).bestMatch.target;
        const action = new CodeAction(`Change to ${value}`, CodeActionKind.QuickFix);
        action.edit = new WorkspaceEdit();
        action.edit.replace(document.uri, range, value);
        return action;
    }
}