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
import { QuestResource } from '../language/common';
import { Quest } from '../language/quest';
import { DiagnosticCode } from '../diagnostics/common';

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
                    case DiagnosticCode.UndefinedAttribute:
                        const parameter = quest.qbn.getParameter(diagnostic.range);
                        if (parameter) {
                            const values = Tables.getInstance().getValues(parameter.type);
                            if (values) {
                                const stringSimilarity = require('string-similarity');
                                const value = stringSimilarity.findBestMatch(document.getText(diagnostic.range), values).bestMatch.target;
                                action = new CodeAction(`Change to ${value}`, CodeActionKind.QuickFix);
                                action.edit = new WorkspaceEdit();
                                action.edit.replace(document.uri, diagnostic.range, value);
                                actions.push(action);
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
                            parser.getSupportedSymbolVariations(currentSymbol, symbolDefinition.type).forEach(newSymbol => {
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
}