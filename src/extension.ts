/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { DocumentFilter, ExtensionContext } from 'vscode';
import { EOL } from 'os';
import { Modules } from './language/static/modules';
import { Language } from './language/static/language';
import { makeDiagnosticCollection } from './diagnostics/diagnostics';
import { TemplateHoverProvider } from './providers/hoverProvider';
import { TemplateCompletionItemProvider } from './providers/completionItemProvider';
import { TemplateSignatureHelpProvider } from './providers/signatureHelpProvider';
import { TemplateDefinitionProvider } from './providers/definitionProvider';
import { TemplateReferenceProvider } from './providers/referenceProvider';
import { TemplateDocumentHighlightProvider } from './providers/documentHighlightProvider';
import { TemplateDocumentSymbolProvider } from './providers/documentSymbolProvider';
import { TemplateWorkspaceSymbolProvider } from './providers/workspaceSymbolProvider';
import { TemplateCodeLensProvider } from './providers/codeLensProvider';
import { TemplateRenameProvider } from './providers/renameProvider';
import { TemplateDocumentRangeFormattingEditProvider } from './providers/documentRangeFormattingEditProvider';
import { TemplateOnTypingFormatter } from './providers/onTypeFormattingEditProvider';
import { TemplateCodeActionProvider } from './providers/codeActionProvider';
import { TemplateFoldingRangeProvider } from './providers/foldingRangeProvider';
import { Tables } from './language/static/tables';
import { tasks } from './parser';
import { Quests } from './language/quests';

export const TEMPLATE_LANGUAGE = 'dftemplate';
export const TEMPLATE_MODE: DocumentFilter[] = [
    { language: TEMPLATE_LANGUAGE, scheme: 'file' }, 
    { language: TEMPLATE_LANGUAGE, scheme: 'untitled' }
];

export function getOptions() {
    return vscode.workspace.getConfiguration('dftemplate');
}

export function activate(context: ExtensionContext) {

    setLanguageConfiguration();

    const language = new Language();

    Promise.all([
        language.load(context),
        Modules.getInstance().load(context),
        Tables.getInstance().load()
    ]).then(() => {
        tasks.setGlobalVariables(Tables.getInstance().globalVarsTable.globalVars);

        const quests = new Quests(language);

        context.subscriptions.push(vscode.languages.registerHoverProvider(TEMPLATE_MODE, new TemplateHoverProvider(language, quests)));
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(TEMPLATE_MODE, new TemplateCompletionItemProvider(language, quests)));
        context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(TEMPLATE_MODE, new TemplateSignatureHelpProvider(language)));
        context.subscriptions.push(vscode.languages.registerDefinitionProvider(TEMPLATE_MODE, new TemplateDefinitionProvider(quests)));
        context.subscriptions.push(vscode.languages.registerReferenceProvider(TEMPLATE_MODE, new TemplateReferenceProvider(quests)));
        context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(TEMPLATE_MODE, new TemplateDocumentHighlightProvider(quests)));
        context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(TEMPLATE_MODE, new TemplateDocumentSymbolProvider(quests)));
        context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new TemplateWorkspaceSymbolProvider(quests)));
        context.subscriptions.push(vscode.languages.registerRenameProvider(TEMPLATE_MODE, new TemplateRenameProvider(quests)));
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(TEMPLATE_MODE, new TemplateDocumentRangeFormattingEditProvider()));
        context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(TEMPLATE_MODE, new TemplateOnTypingFormatter(), '\n'));
        context.subscriptions.push(vscode.languages.registerCodeActionsProvider(TEMPLATE_MODE, new TemplateCodeActionProvider(language, quests, context)));
        context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(TEMPLATE_MODE, new TemplateFoldingRangeProvider(quests)));

        if (getOptions()['codeLens']['enabled']) {
            context.subscriptions.push(vscode.languages.registerCodeLensProvider(TEMPLATE_MODE, new TemplateCodeLensProvider(quests)));
        }

        if (getOptions()['diagnostics']['enabled']) {
            context.subscriptions.push(makeDiagnosticCollection(context, language, quests));
        }

        registerCommands(context, language, quests);
        context.subscriptions.push(quests.initialize());
    }).catch(e => vscode.window.showErrorMessage(`Initialization failed: ${e}`));
}

export function deactivate() {
    Modules.release();
    Tables.release();
}

export function* iterateAll<T>(...iterables: Iterable<T>[]): Iterable<T> {
    for (const iterable of iterables) {
        for (const item of iterable) {
            yield item;
        }
    }
}

/**
 * Finds the first element that satisfies a specified condition.
 */
export function first<T>(iterable: Iterable<T>, predicate?: (item: T) => boolean): T | undefined {
    for (const item of iterable) {
        if (!predicate || predicate(item)) {
            return item;
        }
    }
}

/**
 * Filters a sequence of values with a predicate.
 */
export function* where<T>(iterable: Iterable<T>, predicate: (item: T) => boolean): Iterable<T> {
    for (const item of iterable) {
        if (predicate(item)) {
            yield item;
        }
    }
}

/**
 * Projects each element of a sequence with a transform operation.
 */
export function* select<T1, T2>(iterable: Iterable<T1>, transform: (item: T1) => T2): Iterable<T2> {
    for (const item of iterable) {
        yield transform(item);
    }
}

/**
 * Projects each element of a sequence with a transform operation and flattens the resulting sequence.
 */
export function* selectMany<T1, T2, T3>(iterable: Iterable<T1>, selector: (item: T1) => Iterable<T2>, transform: (item: T2) => T3): Iterable<T3> {
    for (const item of iterable) {
        yield* select(selector(item), x => transform(x));
    }
}

function setLanguageConfiguration() {
    vscode.languages.setLanguageConfiguration(TEMPLATE_LANGUAGE, {
        wordPattern: /(={1,2}|%)?([a-zA-Z0-9_-]+\.)?[a-zA-Z0-9_-]+/g,
        onEnterRules: [
            {
                beforeText: /\s*([^\s]+ task|until [^\s]+ performed):\s*$/,
                action: {
                    indentAction: vscode.IndentAction.Indent
                }
            }
        ]
    });
}

function registerCommands(context: ExtensionContext, language: Language, quests: Quests) {
    context.subscriptions.push(

        vscode.commands.registerTextEditorCommand('dftemplate.toggleCeToken', async textEditor => {

            const messages = quests.get(textEditor.document).qrc.messages;

            for (const selection of textEditor.selections) {
                const message = first(messages, x => x.blockRange.contains(selection));
                if (message !== undefined) {
                    const success = await textEditor.edit(editBuilder => {
                        for (let line = textEditor.selection.start.line; line <= textEditor.selection.end.line; line++) {
                            if (line !== message.range.start.line) {
                                const match = textEditor.document.lineAt(line).text.match(/(\s*<ce>\s*)[^\s]/);
                                if (match) {
                                    editBuilder.delete(new vscode.Range(line, 0, line, match[1].length));
                                } else {
                                    editBuilder.insert(new vscode.Position(line, 0), '<ce>');
                                }
                            }
                        }
                    });

                    if (success) {
                        vscode.commands.executeCommand('editor.action.formatSelection');
                    } else {
                        vscode.window.showErrorMessage('Failed to toggle ce tokens.');
                    }
                } else {
                    vscode.window.showErrorMessage('No message found at selection.');
                }
            }
        }),

        vscode.commands.registerTextEditorCommand('dftemplate.generateMessages', async textEditor => {

            const quest = quests.get(textEditor.document);

            const messages = Tables.getInstance().staticMessagesTable.messages;
            const entries: vscode.QuickPickItem[] = [];
            for (const [alias, id] of messages) {
                if (!quest.qrc.messages.find(x => x.id === id) && !entries.find(x => messages.get(x.label) === id)) {
                    const message = language.findMessage(alias);
                    entries.push({
                        label: alias,
                        detail: String(id),
                        description: message !== undefined ? message.summary : undefined
                    });
                }
            }

            const selection = await vscode.window.showQuickPick(entries, { canPickMany: true, matchOnDetail: true, ignoreFocusOut: true });
            if (selection !== undefined && selection.length > 0) {
                const text = selection.map(selected => {
                    const id = Tables.getInstance().staticMessagesTable.messages.get(selected.label);
                    return [`${selected.label}:  [${id}]`, 'UNDEFINED MESSAGE'].join(EOL);
                }).join(EOL + EOL);

                const qrcRange = quest.qrc.range;
                if (qrcRange !== undefined) {
                    textEditor.edit(editBuilder => editBuilder.insert(qrcRange.end, EOL + text + EOL));
                }
            }
        }),

        vscode.commands.registerTextEditorCommand('dftemplate.orderMessages', async (textEditor, edit) => {
            const messages = quests.get(textEditor.document).qrc.messages;
            const sortedMessages = messages.slice();
            sortedMessages.sort((a, b) => a.id - b.id);

            for (let index = 0; index < messages.length; index++) {
                if (messages[index] !== sortedMessages[index]) {
                    edit.replace(messages[index].blockRange, textEditor.document.getText(sortedMessages[index].blockRange));
                }
            }
        }),

        vscode.commands.registerTextEditorCommand('dftemplate.generateGlobalVariables', async (textEditor, edit) => {
            const qbn = quests.get(textEditor.document).qbn;
            if (qbn.range === undefined) {
                return vscode.window.showErrorMessage('Failed to locate QBN block.');
            }

            const makeDescription = (alias: string) => {
                let description = '';
                for (const char of alias) {
                    description += char !== char.toLowerCase() ? ' ' + char : char;
                }
                return description.trim();
            };

            const entries: vscode.QuickPickItem[] = [];
            for (const [alias, id] of Tables.getInstance().globalVarsTable.globalVars) {
                if (!/^Unused\d+$/.test(alias) && first(qbn.iterateTasks(), x => x.definition.globalVarName === alias) === undefined) {
                    entries.push({
                        label: alias,
                        detail: String(id),
                        description: makeDescription(alias)
                    });
                }
            }

            const selection = await vscode.window.showQuickPick(entries, { canPickMany: true, matchOnDetail: true, ignoreFocusOut: true });
            if (selection !== undefined) {
                textEditor.edit(editBuilder => editBuilder.insert(qbn.range!.end, EOL + selection.map(selected =>
                    `${selected.label} _${selected.label.charAt(0).toLowerCase() + selected.label.slice(1)}_`).join(EOL)));
            }
        })
    );
}