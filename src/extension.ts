/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

import { DocumentFilter, ExtensionContext } from 'vscode';
import { TemplateHoverProvider } from './providers/hoverProvider';
import { TemplateCompletionItemProvider } from './providers/completionItemProvider';
import { TemplateDefinitionProvider } from './providers/definitionProvider';
import { TemplateReferenceProvider } from './providers/referenceProvider';
import { TemplateDocumentSymbolProvider } from './providers/documentSymbolProvider';
import { TemplateRenameProvider } from './providers/renameProvider';
import { TemplateDocumentRangeFormattingEditProvider } from './providers/documentRangeFormattingEditProvider';
import { Modules } from './language/modules';

const TEMPLATE_LANGUAGE = 'dftemplate';
const TEMPLATE_MODE: DocumentFilter[] = [
    { language: TEMPLATE_LANGUAGE, scheme: 'file' }, 
    { language: TEMPLATE_LANGUAGE, scheme: 'untitled' }
];

export class Options {
    public static centeredMessages: boolean;
    public static modules: string[];
}

export function activate(context: ExtensionContext) {

    vscode.languages.setLanguageConfiguration(TEMPLATE_LANGUAGE, { wordPattern: /(={1,2}|%)?(\w|\d)+/g });

    let config = vscode.workspace.getConfiguration('dftemplate');
    Options.centeredMessages = config.get<boolean>('format.centeredMessages') || Options.centeredMessages;
    Options.modules = config.get<string[]>('modules') || [];

    Modules.getInstance().load(context);

    context.subscriptions.push(vscode.languages.registerHoverProvider(TEMPLATE_MODE, new TemplateHoverProvider(context)));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(TEMPLATE_MODE, new TemplateCompletionItemProvider(context)));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(TEMPLATE_MODE, new TemplateDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(TEMPLATE_MODE, new TemplateReferenceProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(TEMPLATE_MODE, new TemplateDocumentSymbolProvider()));
    context.subscriptions.push(vscode.languages.registerRenameProvider(TEMPLATE_MODE, new TemplateRenameProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(TEMPLATE_MODE, new TemplateDocumentRangeFormattingEditProvider()));  
}

export function deactivate() {
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
    });
}