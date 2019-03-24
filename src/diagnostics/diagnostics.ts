/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';

import { TEMPLATE_LANGUAGE, getOptions } from '../extension';
import { analysePreamble } from './preambleCheck';
import { analyseQrc } from './qrcCheck';
import { analyseQbn } from './qbnCheck';
import { tableCheck } from './tableCheck';
import { Errors } from './common';
import { Quest } from '../language/quest';

let timer: NodeJS.Timer | null = null;

/**
 * Makes a diagnostic collection and subscribes to events for diagnostic.
 * @param context Extension context.
 */
export function makeDiagnosticCollection(context: vscode.ExtensionContext): vscode.DiagnosticCollection {

    const diagnosticsOption = getOptions()['diagnostics'];
    const liveDiagnostics = diagnosticsOption['live'];
    const delay = diagnosticsOption['delay'];
    const diagnosticCollection = vscode.languages.createDiagnosticCollection(TEMPLATE_LANGUAGE);

    // Do diagnostics for current file
    if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        if (document.languageId === TEMPLATE_LANGUAGE) {
            diagnosticCollection.set(document.uri, doDiagnostics(document));
        }
    }

    // Do diagnostics for opened files
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === TEMPLATE_LANGUAGE) {
            diagnosticCollection.set(document.uri, doDiagnostics(document));
        }
    }));

    if (liveDiagnostics) {

        // Do live diagnostics
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            if (e.document.languageId === TEMPLATE_LANGUAGE) {

                if (timer !== null) {
                    clearTimeout(timer);
                }

                timer = setTimeout(() => {
                    diagnosticCollection.set(e.document.uri, doDiagnostics(e.document));
                    timer = null;
                }, delay);
            }
        }));
    }
    else {

        // Do diagnostics only on save
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === TEMPLATE_LANGUAGE) {
                diagnosticCollection.set(document.uri, doDiagnostics(document));
            }
        }));
    }

    return diagnosticCollection;
}

/**
 * Makes diagostics for the given document.
 */
function doDiagnostics(document: vscode.TextDocument) {

    if (parser.isQuestTable(document)) {
        
        // Analyse table
        return Array.from(tableCheck(document));
    } else {
        
        // Analyse quest
        const context = Quest.get(document);
        return [
            ...analysePreamble(context),
            ...(context.qrc.found ? analyseQrc(context) : failedAnalysis(context, 'QRC')),
            ...(context.qbn.found ? analyseQbn(context) : failedAnalysis(context, 'QBN'))
        ];
    }
}

function* failedAnalysis(context: Quest, name: string): Iterable<vscode.Diagnostic> {
    const questName = context.preamble.questName;
    if (questName) {
        yield Errors.blockMissing(questName.line.range, name);
    }

    return;
}