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

            const commands: vscode.Command[] = [];

            context.diagnostics.forEach(diagnostic => {
                switch (diagnostic.code) {
                    case DiagnosticCode.DuplicatedMessageNumber:
                        const messageID = document.getText(diagnostic.range);
                        const newMessageID = parser.nextAvailableMessageID(document, messageID);
                        commands.push({
                            title: 'Change ' + messageID + ' to ' + newMessageID,
                            command: 'dftemplate.renameSymbol',
                            arguments: Array<any>(diagnostic.range, newMessageID)
                        });
                        break;
                    case DiagnosticCode.UnusedDeclarationMessage:
                        commands.push({
                            title: 'Remove unused declaration',
                            command: 'dftemplate.deleteRange',
                            arguments: Array<any>(parser.getMessageRange(document, diagnostic.range.start.line))
                        });
                        break;
                    case DiagnosticCode.UnusedDeclarationSymbol:
                        commands.push({
                            title: 'Remove unused declaration',
                            command: 'dftemplate.deleteRange',
                            arguments: Array<any>(document.lineAt(diagnostic.range.start.line).range)
                        });
                        break;
                    case DiagnosticCode.UnusedDeclarationTask:
                        commands.push({
                            title: 'Remove unused declaration',
                            command: 'dftemplate.deleteRange',
                            arguments: Array<any>(parser.getTaskRange(document, diagnostic.range.start.line))
                        });
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
                        const definition = parser.findSymbolDefinition(document, currentSymbol);
                        if (definition) {
                            parser.getSupportedSymbolVariations(currentSymbol, definition.type).forEach((newSymbol) => {
                                if (newSymbol.word !== currentSymbol) {
                                    commands.push({
                                        title: 'Change ' + currentSymbol + ' to ' + newSymbol.word + ' (' + newSymbol.description + ')',
                                        command: 'dftemplate.renameSymbol',
                                        arguments: Array<any>(diagnostic.range, newSymbol.word)
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
                            arguments: Array<any>(diagnostic.range, newName)
                        });
                        break;
                    case DiagnosticCode.UseAliasForStaticMessage:
                        const messageLine = document.lineAt(diagnostic.range.start.line);
                        const id = parser.getMessageIDFromLine(messageLine);
                        if (id) {
                            for (const message of Tables.getInstance().staticMessagesTable.messages) {
                                if (String(message["1"]) === id) {
                                    commands.push({
                                        title: 'Convert ' + id + ' to ' + message["0"],
                                        command: 'dftemplate.renameSymbol',
                                        arguments: Array<any>(messageLine.range, message["0"] + ':   [' + id + ']')
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