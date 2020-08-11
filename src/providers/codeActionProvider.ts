/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { CodeAction, CodeActionKind, DiagnosticSeverity, WorkspaceEdit, ExtensionContext } from 'vscode';
import { getOptions, first, where } from '../extension';
import { StaticData } from '../language/static/staticData';
import { ParameterTypes } from '../language/static/parameterTypes';
import { LanguageData } from '../language/static/languageData';
import { QuestResource, Task } from '../language/common';
import { Quests } from '../language/quests';
import { DiagnosticCode } from '../diagnostics/common';
import { symbols, wordRange } from '../parser';
import { TemplateReferenceProvider } from './referenceProvider';
import { TemplateRenameProvider } from './renameProvider';

export class TemplateCodeActionProvider implements vscode.CodeActionProvider {

    public constructor(private readonly data: LanguageData, private readonly quests: Quests, context: ExtensionContext) {

        context.subscriptions.push(

            vscode.commands.registerCommand('dftemplate.insertSnippetAtRange', (snippet: string, range: vscode.Range) => {
                if (vscode.window.activeTextEditor) {
                    vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(snippet), range);
                }
            }),

            vscode.commands.registerTextEditorCommand('dftemplate.extractTask', async (textEditor: vscode.TextEditor, _, origin: Task, range: vscode.Range) => {
                const replaceRange = new vscode.Range(new vscode.Position(range.start.line, 0), range.end);
                const line = textEditor.document.lineAt(range.start.line);
                const actionText = `${line.text.substring(0, line.firstNonWhitespaceCharacterIndex)}start task _taskName_`;

                if (await textEditor.edit(editBuilder => {
                    editBuilder.replace(replaceRange, actionText);
                    editBuilder.insert(new vscode.Position(origin.blockRange.end.line + 2, 0),
                        `_taskName_ task:\n${textEditor.document.getText(replaceRange)}\n\n`);
                })) {
                    const pos = new vscode.Position(replaceRange.start.line, actionText.length - 1);
                    textEditor.selection = new vscode.Selection(pos, pos);
                    vscode.commands.executeCommand('editor.action.rename').then(undefined, () => { });
                }
            })
        );
    }

    public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext):
        Promise<vscode.CodeAction[]> {

        const quest = this.quests.get(document);
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
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
                            ...this.data.language.caseInsensitiveSeek(prefix),
                            ...this.data.modules.caseInsensitiveSeek(prefix)]) {
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
                    const message = quest.qrc.getMessage(diagnostic.range, this.data.tables);
                    if (message && message.alias) {
                        const aliasRange = wordRange(document.lineAt(diagnostic.range.start.line), message.alias);
                        for (const [name, id] of this.data.tables.staticMessagesTable.messages) {
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
                    action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, this.data.language.contextMacros);
                    if (action) {
                        actions.push(action);
                    }
                    break;
                case DiagnosticCode.UndefinedSymbol:
                    const symbolParameter = quest.qbn.getParameter(diagnostic.range);
                    if (symbolParameter) {
                        const symbolNames = Array.from(quest.qbn.iterateSymbols())
                            .filter(x => x.type === symbols.symbolPlaceholderToType(symbolParameter.type))
                            .map(x => x.name);
                        action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, symbolNames);
                    } else if (quest.qrc.range && quest.qrc.range.contains(diagnostic.range)) {
                        const symbol = document.getText(diagnostic.range);
                        const name = parser.symbols.getSymbolName(symbol);
                        const symbolNames = Array.from(quest.qbn.iterateSymbols())
                            .map(x => symbol.replace(name, parser.symbols.getSymbolName(x.name)));
                        action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, symbolNames);
                    }
                    if (action) {
                        actions.push(action);
                    }
                    break;
                case DiagnosticCode.UndefinedTask:
                    const taskNames = Array.from(quest.qbn.iterateTasks()).map(x => x.definition.symbol);
                    action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, taskNames);
                    if (action) {
                        actions.push(action);
                    }
                    break;
                case DiagnosticCode.UndefinedQuest:
                    const questNames = (await this.quests.getAll()).reduce((names, quest) => {
                        const name = quest.getName();
                        if (name) {
                            names.push(name);
                        }

                        return names;
                    }, [] as string[]);
                    action = TemplateCodeActionProvider.bestMatch(document, diagnostic.range, questNames);
                    if (action) {
                        actions.push(action);
                    }
                    break;
                case DiagnosticCode.UndefinedAttribute:
                    const parameter = quest.qbn.getParameter(diagnostic.range);
                    if (parameter) {
                        const values = this.data.tables.getValues(parameter.type);
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
                        this.data.language.getSymbolVariations(currentSymbol, symbolDefinition.type).forEach(newSymbol => {
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
                    const symbolName = document.getText(diagnostic.range);
                    const symbol = quest.qbn.getSymbol(symbolName);
                    if (symbol !== undefined) {
                        const newName = parser.symbols.forceSymbolNamingConventions(symbolName);
                        action = new CodeAction(`Rename ${symbolName} to ${newName}`, CodeActionKind.QuickFix);
                        action.edit = TemplateRenameProvider.renameSymbol(quest, symbol, newName);
                        actions.push(action);
                    }
                    break;
                case DiagnosticCode.UseAliasForStaticMessage:
                    const numericMessage = quest.qrc.messages.find(x => x.range.isEqual(diagnostic.range));
                    if (numericMessage) {
                        for (const [alias, id] of this.data.tables.staticMessagesTable.messages) {
                            if (id === numericMessage.id) {
                                action = new CodeAction(`Convert ${numericMessage.id} to ${alias}`, CodeActionKind.QuickFix);
                                action.edit = new WorkspaceEdit();
                                action.edit.replace(document.uri, document.lineAt(numericMessage.range.start.line).range, `${alias}:   [${numericMessage.id}]`);
                                actions.push(action);
                            }
                        }
                    }
                    break;
                case DiagnosticCode.QuestNameMismatch:
                    const questNameDirective = quest.preamble.questName;
                    if (questNameDirective !== undefined) {
                        const newName = quest.name;
                        action = new CodeAction(`Change name to ${newName}`, CodeActionKind.QuickFix);
                        action.edit = new WorkspaceEdit();
                        action.edit.replace(document.uri, questNameDirective.valueRange, newName);
                        actions.push(action);
                    }
                break;
                case DiagnosticCode.OrderMessages:
                    action = new CodeAction('Order messages', CodeActionKind.RefactorRewrite);
                    action.command = {
                        title: action.title,
                        command: 'dftemplate.orderMessages'
                    };
                    actions.push(action);
                    break;
                case DiagnosticCode.ConvertTaskToVariable:
                    const task = quest.qbn.getTask(diagnostic.range);
                    if (task) {
                        action = new CodeAction('Convert to variable', CodeActionKind.QuickFix);
                        action.edit = new WorkspaceEdit();
                        action.edit.replace(document.uri, task.blockRange, `variable ${task.definition.symbol}`);
                        if (getOptions()['diagnostics']['hintTaskActivationForm']) {
                            TemplateCodeActionProvider.changeTextEdits(document,
                                TemplateReferenceProvider.taskReferences(quest, task, false), 'start task', 'setvar', action.edit);
                        }
                        actions.push(action);
                    }
                    break;
                case DiagnosticCode.ChangeStartTastToSetVar:
                    actions.push(TemplateCodeActionProvider.changeText(document, diagnostic.range, 'start task', 'setvar'));
                    break;
                case DiagnosticCode.ChangeSetVarToStartTask:
                    actions.push(TemplateCodeActionProvider.changeText(document, diagnostic.range, 'setvar', 'start task'));
                    break;
            }
        }

        const qrcRange = quest.qrc.range;
        if (qrcRange !== undefined && range.intersection(qrcRange.with(undefined, new vscode.Position(qrcRange.start.line + 1, 0))) !== undefined) {
            const action = new CodeAction('Generate messages', CodeActionKind.RefactorRewrite);      
            action.command = {
                title: action.title,
                command: 'dftemplate.generateMessages'
            };
            actions.push(action);
        }

        for (const message of where(quest.qrc.messages, x => x.aliasRange !== undefined && x.aliasRange.intersection(range) !== undefined)) {
            for (const [alias, id] of this.data.tables.staticMessagesTable.messages) {
                if (message.id === id && message.alias !== alias) {
                    const action = new CodeAction(`Change to ${alias}`, CodeActionKind.RefactorRewrite);
                    action.edit = new WorkspaceEdit();
                    action.edit.replace(document.uri, message.aliasRange!, alias);
                    actions.push(action);
                }
            }
        }

        const qbnRange = quest.qbn.range;
        if (qbnRange !== undefined && range.intersection(qbnRange.with(undefined, new vscode.Position(qbnRange.start.line + 1, 0))) !== undefined) {
            const action = new CodeAction('Generate global variables', CodeActionKind.RefactorRewrite);      
            action.command = {
                title: action.title,
                command: 'dftemplate.generateGlobalVariables'
            };
            actions.push(action);
        }

        if (range.isSingleLine) {
            for (const task of quest.qbn.iterateTasks()) {
                if (task.range.intersection(range) !== undefined && task.definition.type === parser.tasks.TaskType.Variable) {
                    const action = new CodeAction('Convert to task', CodeActionKind.RefactorRewrite);
                    action.edit = new WorkspaceEdit();
                    action.edit.replace(document.uri, task.blockRange, `${task.definition.symbol} task:`);
                    if (getOptions()['diagnostics']['hintTaskActivationForm']) {
                        TemplateCodeActionProvider.changeTextEdits(document,
                            TemplateReferenceProvider.taskReferences(quest, task, false), 'setvar', 'start task', action.edit);
                    }
                    actions.push(action);
                }
            }
        }

        if (!range.isEmpty) {
            for (const task of quest.qbn.iterateTasks()) {
                if (task.isValidSubRange(range)) {
                    const action = new CodeAction('Extract to new task', CodeActionKind.RefactorExtract);
                    action.command = {
                        title: action.title,
                        command: 'dftemplate.extractTask',
                        arguments: [task, range]
                    };
                    actions.push(action);
                }
            }
        }

        return actions;
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

    private static bestMatch(document: vscode.TextDocument, range: vscode.Range, values: string[]): CodeAction | undefined {
        if (values.length === 0) {
            return undefined;
        }

        const stringSimilarity = require('string-similarity');
        const value = stringSimilarity.findBestMatch(document.getText(range), values).bestMatch.target;
        const action = new CodeAction(`Change to ${value}`, CodeActionKind.QuickFix);
        action.edit = new WorkspaceEdit();
        action.edit.replace(document.uri, range, value);
        return action;
    }

    private static changeText(document: vscode.TextDocument, range: vscode.Range, from: string, to: string) {
        const action = new CodeAction(`Change to ${to}`, CodeActionKind.QuickFix);
        action.edit = new WorkspaceEdit();
        action.edit.replace(document.uri, wordRange(document.lineAt(range.start.line), from), to);
        return action;
    }

    private static changeTextEdits(document: vscode.TextDocument, locations: vscode.Location[], from: string, to: string, edit: WorkspaceEdit) {
        for (const location of locations) {
            const range = wordRange(document.lineAt(location.range.start.line), from);
            if (!range.isEmpty) {
                edit.replace(document.uri, range, to);
            }
        }
    }
}