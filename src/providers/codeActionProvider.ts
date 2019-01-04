/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { DiagnosticCode } from '../diagnostics/common';
import { Tables } from '../language/static/tables';
import { Modules } from '../language/static/modules';
import { Language } from '../language/static/language';
import { StaticData } from '../language/static/staticData';
import { Quest } from '../language/quest';
import { first } from '../extension';


export class TemplateCodeActionProvider implements vscode.CodeActionProvider {

    public constructor() {
        vscode.commands.registerCommand('dftemplate.deleteRange', (range: vscode.Range) => {
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.edit((editBuilder) => {
                    editBuilder.delete(range);
                });
            }
        });

        vscode.commands.registerCommand('dftemplate.renameSymbol', (range: vscode.Range, newName: string) => {
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.edit((editBuilder) => {
                    editBuilder.replace(range, newName);
                });
            }
        });

        vscode.commands.registerCommand('dftemplate.insertSnippetAtRange', (snippet: string, range: vscode.Range) => {
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(snippet), range);
            }
        });
    }

    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext):
        Thenable<vscode.Command[]> {

        return new Promise((resolve, reject) => {

            const quest = Quest.get(document);
            const commands: vscode.Command[] = [];

            context.diagnostics.forEach(diagnostic => {
                switch (diagnostic.code) {
                    case DiagnosticCode.DuplicatedMessageNumber:
                        const duplicatedMessage = quest.qrc.messages.find(x => x.range.isEqual(diagnostic.range));
                        if (duplicatedMessage) {
                            const newMessageID = quest.qrc.getAvailableId(duplicatedMessage.id);
                            commands.push({
                                title: 'Change ' + duplicatedMessage.id + ' to ' + newMessageID,
                                command: 'dftemplate.renameSymbol',
                                arguments: [diagnostic.range, String(newMessageID)]
                            });
                        }
                        break;
                    case DiagnosticCode.UnusedDeclarationMessage:
                        const message = quest.qrc.messages.find(x => x.range.isEqual(diagnostic.range));
                        if (message) {
                            commands.push({
                                title: 'Remove unused declaration',
                                command: 'dftemplate.deleteRange',
                                arguments: [message.blockRange]
                            });
                        }
                        break;
                    case DiagnosticCode.UnusedDeclarationSymbol:
                        commands.push({
                            title: 'Remove unused declaration',
                            command: 'dftemplate.deleteRange',
                            arguments: [document.lineAt(diagnostic.range.start.line).range]
                        });
                        break;
                    case DiagnosticCode.UnusedDeclarationTask:
                        const task = first(quest.qbn.iterateTasks(), x => x.range.isEqual(diagnostic.range));
                        if (task) {
                            commands.push({
                                title: 'Remove unused declaration',
                                command: 'dftemplate.deleteRange',
                                arguments: [task.blockRange]
                            });
                        }
                        break;
                    case DiagnosticCode.UndefinedExpression:
                        const prefix = parser.getFirstWord((document.lineAt(diagnostic.range.start.line).text));
                        if (prefix) {
                            for (const signature of [
                                ...Language.getInstance().caseInsensitiveSeek(prefix),
                                ...Modules.getInstance().caseInsensitiveSeek(prefix)]) {
                                commands.push({
                                    title: 'Change to \'' + StaticData.prettySignature(signature) + '\'',
                                    command: 'dftemplate.insertSnippetAtRange',
                                    arguments: [signature, diagnostic.range]
                                });
                            }
                        }
                        break;
                    case DiagnosticCode.IncorrectSymbolVariation:
                        const currentSymbol = document.getText(diagnostic.range);
                        const symbolDefinition = quest.qbn.getSymbol(currentSymbol);
                        if (symbolDefinition) {
                            parser.getSupportedSymbolVariations(currentSymbol, symbolDefinition.type).forEach((newSymbol) => {
                                if (newSymbol.word !== currentSymbol) {
                                    commands.push({
                                        title: 'Change ' + currentSymbol + ' to ' + newSymbol.word + ' (' + newSymbol.description + ')',
                                        command: 'dftemplate.renameSymbol',
                                        arguments: [diagnostic.range, newSymbol.word]
                                    });
                                }
                            });
                        }
                        break;
                    case DiagnosticCode.SymbolNamingConvention:
                        const symbol = document.getText(diagnostic.range);
                        const newName = parser.forceSymbolNamingConventions(symbol);
                        commands.push({
                            title: 'Convert ' + symbol + ' to ' + newName,
                            command: 'dftemplate.renameSymbol',
                            arguments: [diagnostic.range, newName]
                        });
                        break;
                    case DiagnosticCode.UseAliasForStaticMessage:
                        const numericMessage = quest.qrc.messages.find(x => x.range.isEqual(diagnostic.range));
                        if (numericMessage) {
                            for (const [alias, id] of Tables.getInstance().staticMessagesTable.messages) {
                                if (id === numericMessage.id) {
                                    commands.push({
                                        title: 'Convert ' + numericMessage.id + ' to ' + alias,
                                        command: 'dftemplate.renameSymbol',
                                        arguments: [document.lineAt(numericMessage.range.start.line).range, alias + ':   [' + numericMessage.id + ']']
                                    });
                                }
                            }
                        }
                        break;
                }
            });

            return commands.length > 0 ? resolve(commands) : reject();
        });
    }
}