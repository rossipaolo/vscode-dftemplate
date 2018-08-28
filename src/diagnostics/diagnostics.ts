/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { TEMPLATE_LANGUAGE, getOptions } from '../extension';
import { Language } from '../language/language';
import { doSignatureChecks } from './signatureCheck';
import { MessageBlock } from '../parsers/parser';
import { qrcCheck } from './qrcCheck';
import { qbnCheck } from './qbnCheck';
import { tableCheck } from './tableCheck';
import { Errors } from './common';

enum QuestBlock {
    Preamble,
    QRC,
    QBN
}

export interface DiagnosticContext {
    questName: vscode.Range | null;
    qrcFound: boolean;
    qbnFound: boolean;
    messages: number[];
    symbols: string[];
    tasks: string[];
    messageBlock: MessageBlock | null;
}

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
        return Array.from(tableCheck(document));
    }
    
    const diagnostics: vscode.Diagnostic[] = [];
    let block = QuestBlock.Preamble;

    const getBlockChecker = (block: any) =>
        block === QuestBlock.Preamble ? preambleCheck : (block === QuestBlock.QRC ? qrcCheck : qbnCheck);

    const context: DiagnosticContext = {
        questName: null,
        qrcFound: false,
        qbnFound: false,
        messages: [],
        symbols: [],
        tasks: [],
        messageBlock: null
    };

    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);

        // Skip comments and empty lines
        if (parser.isEmptyOrComment(line.text)) {
            continue;
        }

        // Detect next block
        if (line.text.indexOf('QRC:') !== -1) {
            block = QuestBlock.QRC;
            context.qrcFound = true;
            continue;
        }
        else if (line.text.indexOf('QBN:') !== -1) {
            block = QuestBlock.QBN;
            context.qbnFound = true;
            continue;
        }

        // Do diagnostics for current block
        for (const diagnostic of getBlockChecker(block)(document, line, context)) {
            diagnostics.push(diagnostic);
        }
    }

    // Do diagnostics for quest logic
    for (const diagnostic of logicCheck(context)) {
        diagnostics.push(diagnostic);
    }

    return diagnostics;
}

/**
 * Do diagnostics for a line in the preamble.
 * @param document A quest document.
 * @param line A line in the preamble.
 * @param context Context data for current diagnostics operation. 
 */
function* preambleCheck(document: vscode.TextDocument, line: vscode.TextLine, context: DiagnosticContext): Iterable<vscode.Diagnostic> {
    const word = parser.getFirstWord(line.text);
    if (word) {

        // Check signature
        const result = Language.getInstance().findKeyword(word);
        if (result) {
            for (const diagnostic of doSignatureChecks(document, result.signature, line)) {
                diagnostic.source = TEMPLATE_LANGUAGE;
                yield diagnostic;
            }

            if (!context.questName && /^\s*Quest:/.test(line.text)) {
                context.questName = line.range;
            }
            
        }
        else {
            yield Errors.undefinedExpression(parser.trimRange(line), 'Preamble');   
        }
    }
}

function* logicCheck(context: DiagnosticContext): Iterable<vscode.Diagnostic> {
    if (context.questName) {
        if (!context.qrcFound) {
            yield Errors.blockMissing(context.questName, 'QRC');
        }
        if (!context.qbnFound) {
            yield Errors.blockMissing(context.questName, 'QBN');
        }
    }
}