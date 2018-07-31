/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

import { DocumentFilter, ExtensionContext } from 'vscode';
import { Modules } from './language/modules';
import { Language } from './language/language';
import { makeDiagnosticCollection } from './language/diagnostics';
import { TemplateHoverProvider } from './providers/hoverProvider';
import { TemplateCompletionItemProvider } from './providers/completionItemProvider';
import { TemplateDefinitionProvider } from './providers/definitionProvider';
import { TemplateReferenceProvider } from './providers/referenceProvider';
import { TemplateDocumentHighlightProvider } from './providers/documentHighlightProvider';
import { TemplateDocumentSymbolProvider } from './providers/documentSymbolProvider';
import { TemplateRenameProvider } from './providers/renameProvider';
import { TemplateDocumentRangeFormattingEditProvider } from './providers/documentRangeFormattingEditProvider';
import { TemplateCodeActionProvider } from './providers/codeActionProvider';

export const TEMPLATE_LANGUAGE = 'dftemplate';
export const TEMPLATE_MODE: DocumentFilter[] = [
    { language: TEMPLATE_LANGUAGE, scheme: 'file' }, 
    { language: TEMPLATE_LANGUAGE, scheme: 'untitled' }
];

export function getOptions() {
    return vscode.workspace.getConfiguration('dftemplate');
}

export function activate(context: ExtensionContext) {

    vscode.languages.setLanguageConfiguration(TEMPLATE_LANGUAGE, { wordPattern: /(={1,2}|%)?(\w|\d)+/g });

    context.subscriptions.push(vscode.languages.registerHoverProvider(TEMPLATE_MODE, new TemplateHoverProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(TEMPLATE_MODE, new TemplateCompletionItemProvider(context)));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(TEMPLATE_MODE, new TemplateDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(TEMPLATE_MODE, new TemplateReferenceProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(TEMPLATE_MODE, new TemplateDocumentHighlightProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(TEMPLATE_MODE, new TemplateDocumentSymbolProvider()));
    context.subscriptions.push(vscode.languages.registerRenameProvider(TEMPLATE_MODE, new TemplateRenameProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(TEMPLATE_MODE, new TemplateDocumentRangeFormattingEditProvider()));
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(TEMPLATE_MODE, new TemplateCodeActionProvider()));

    Promise.all(Array(
        Language.getInstance().load(context), 
        Modules.getInstance().load(context))).then(() => {
        if (getOptions()['diagnostics']['enabled']) {
            context.subscriptions.push(makeDiagnosticCollection(context));
        }
    }, () => vscode.window.showErrorMessage('Failed to enable diagnostics.'));
}

export function deactivate() {
    Language.release();
    Modules.release();
}

export function loadTable(context: ExtensionContext, location: string): Thenable<any> {
    return vscode.workspace.openTextDocument(path.join(context.extensionPath, location)).then((document) => {
        let obj = JSON.parse(document.getText());
        if (obj){
            return obj;
        }

        console.error('Failed to parse ' + location);
    }, () => console.error('Failed to load ' + location));
}

export function parseFromJson(fullPath: string): Thenable<any> {
    return vscode.workspace.openTextDocument(fullPath).then((document) => {
        let obj = JSON.parse(document.getText());
        if (obj) {
            return obj;
        }
    }, () => console.log('Failed to parse ' + fullPath));
}

export function* iterateAll<T>(...iterables: Iterable<T>[]): Iterable<T> {
    for (const iterable of iterables) {
        for (const item of iterable) {
            yield item;
        }
    }
}