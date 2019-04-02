/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { DocumentFilter, ExtensionContext } from 'vscode';
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
import { Tables } from './language/static/tables';
import { tasks } from './parser';
import { Quest } from './language/quest';

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

    Promise.all([
        Language.getInstance().load(context),
        Modules.getInstance().load(context),
        Tables.getInstance().load()
    ]).then(() => {
        tasks.setGlobalVariables(Tables.getInstance().globalVarsTable.globalVars);

        context.subscriptions.push(vscode.languages.registerHoverProvider(TEMPLATE_MODE, new TemplateHoverProvider()));
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider(TEMPLATE_MODE, new TemplateCompletionItemProvider()));
        context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(TEMPLATE_MODE, new TemplateSignatureHelpProvider()));
        context.subscriptions.push(vscode.languages.registerDefinitionProvider(TEMPLATE_MODE, new TemplateDefinitionProvider()));
        context.subscriptions.push(vscode.languages.registerReferenceProvider(TEMPLATE_MODE, new TemplateReferenceProvider()));
        context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(TEMPLATE_MODE, new TemplateDocumentHighlightProvider()));
        context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(TEMPLATE_MODE, new TemplateDocumentSymbolProvider()));
        context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new TemplateWorkspaceSymbolProvider()));
        context.subscriptions.push(vscode.languages.registerRenameProvider(TEMPLATE_MODE, new TemplateRenameProvider()));
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(TEMPLATE_MODE, new TemplateDocumentRangeFormattingEditProvider()));
        context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(TEMPLATE_MODE, new TemplateOnTypingFormatter(), '\n'));
        context.subscriptions.push(vscode.languages.registerCodeActionsProvider(TEMPLATE_MODE, new TemplateCodeActionProvider()));

        if (getOptions()['codeLens']['enabled']) {
            context.subscriptions.push(vscode.languages.registerCodeLensProvider(TEMPLATE_MODE, new TemplateCodeLensProvider()));
        }

        if (getOptions()['diagnostics']['enabled']) {
            context.subscriptions.push(makeDiagnosticCollection(context));
        }

        registerCommands(context);
        context.subscriptions.push(Quest.initialize());
    }).catch(e => vscode.window.showErrorMessage(`Initialization failed: ${e}`));
}

export function deactivate() {
    Language.release();
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

function registerCommands(context: ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('dftemplate.toggleCeToken', textEditor => {
        textEditor.edit(editBuilder => {
            for (let line = textEditor.selection.start.line; line <= textEditor.selection.end.line; line++) {
                const match = textEditor.document.lineAt(line).text.match(/(\s*<ce>\s*)[^\s]/);
                if (match) {
                    editBuilder.replace(new vscode.Range(line, 0, line, match[1].length), '');
                } else {
                    editBuilder.insert(new vscode.Position(line, 0), '<ce>');
                }
            }
        }).then(success => {
            if (success) {
                vscode.commands.executeCommand('editor.action.formatSelection');
            } else {
                vscode.window.showInformationMessage('Failed to toggle ce tokens.');
            }
        });
    }));
}