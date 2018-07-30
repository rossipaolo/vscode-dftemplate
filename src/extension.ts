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
import { TemplateDocumentHighlightProvider } from './providers/documentHighlightProvider';
import { TemplateDocumentSymbolProvider } from './providers/documentSymbolProvider';
import { TemplateRenameProvider } from './providers/renameProvider';
import { TemplateDocumentRangeFormattingEditProvider } from './providers/documentRangeFormattingEditProvider';
import { Modules } from './language/modules';
import { Language } from './language/language';

const TEMPLATE_LANGUAGE = 'dftemplate';
const TEMPLATE_MODE: DocumentFilter[] = [
    { language: TEMPLATE_LANGUAGE, scheme: 'file' }, 
    { language: TEMPLATE_LANGUAGE, scheme: 'untitled' }
];

export class Options {
    public static centeredMessages: boolean;
    public static diagnostics: boolean;
    public static modules: string[];
}

export function activate(context: ExtensionContext) {

    vscode.languages.setLanguageConfiguration(TEMPLATE_LANGUAGE, { wordPattern: /(={1,2}|%)?(\w|\d)+/g });

    let config = vscode.workspace.getConfiguration('dftemplate');
    Options.centeredMessages = config.get<boolean>('format.centeredMessages') || Options.centeredMessages;
    Options.diagnostics = config.get<boolean>('diagnostics.enabled') || Options.diagnostics;
    Options.modules = config.get<string[]>('modules') || [];

    Language.getInstance().load(context);
    Modules.getInstance().load(context);

    context.subscriptions.push(vscode.languages.registerHoverProvider(TEMPLATE_MODE, new TemplateHoverProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(TEMPLATE_MODE, new TemplateCompletionItemProvider(context)));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(TEMPLATE_MODE, new TemplateDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(TEMPLATE_MODE, new TemplateReferenceProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentHighlightProvider(TEMPLATE_MODE, new TemplateDocumentHighlightProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(TEMPLATE_MODE, new TemplateDocumentSymbolProvider()));
    context.subscriptions.push(vscode.languages.registerRenameProvider(TEMPLATE_MODE, new TemplateRenameProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(TEMPLATE_MODE, new TemplateDocumentRangeFormattingEditProvider()));

    if (Options.diagnostics) {
        context.subscriptions.push(makeDiagnosticCollection(context));
    }
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
    });
}

export function* iterateAll<T>(...iterables: Iterable<T>[]): Iterable<T> {
    for (const iterable of iterables) {
        for (const item of iterable) {
            yield item;
        }
    }
}

/**
 * Makes a diagnostic collection and subscribes to events for diagnostic.
 */
function makeDiagnosticCollection(context: vscode.ExtensionContext): vscode.DiagnosticCollection {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection(TEMPLATE_LANGUAGE);

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        if (document.languageId === TEMPLATE_LANGUAGE) {

            const diagnostics: vscode.Diagnostic[] = [];

            for (let index = 0; index < document.lineCount; index++) {
                const line = document.lineAt(index);
                for (const error of iterateAll(
                    Language.getInstance().doDiagnostics(document, line.text),
                    Modules.getInstance().doDiagnostics(document, line.text))) {
                    const diagnostic = new vscode.Diagnostic(trimRange(line), error);
                    diagnostic.source = TEMPLATE_LANGUAGE;
                    diagnostics.push(diagnostic);
                }
            }

            diagnosticCollection.set(document.uri, diagnostics);
        }
    }));

    return diagnosticCollection;
}

/**
 * Gets the range for a line without leading and trailing spaces.
 */
function trimRange(line: vscode.TextLine): vscode.Range {
    const end = line.text.replace(/\s+$/, '').length;
    return new vscode.Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex, line.lineNumber, end);
}