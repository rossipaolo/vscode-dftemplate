/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { TEMPLATE_LANGUAGE, getOptions } from '../extension';
import { Language } from '../language/language';
import { analyseActionSignature } from './signatureCheck';
import { qrcCheck } from './qrcCheck';
import { parseQbn, analyseQbn } from './qbnCheck';
import { tableCheck } from './tableCheck';
import { Errors, DiagnosticContext } from './common';

enum QuestBlock {
    Preamble,
    QRC,
    QBN
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

    const context = new DiagnosticContext(document);

    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);

        // Skip comments and empty lines
        if (parser.isEmptyOrComment(line.text)) {
            continue;
        }

        // Detect next block
        if (line.text.indexOf('QRC:') !== -1) {
            block = QuestBlock.QRC;
            context.qrc.found = true;
            continue;
        }
        else if (line.text.indexOf('QBN:') !== -1) {
            block = QuestBlock.QBN;
            context.qbn.found = true;
            continue;
        }

        // Parse current block
        switch (block) {
            case QuestBlock.Preamble:
                parsePreamble(line, context);
                break;
            case QuestBlock.QBN:
                parseQbn(line, context);
                break;
            default:
                for (const diagnostic of qrcCheck(document, line, context)) {
                    diagnostics.push(diagnostic);
                }
                break;
        }
    }

    // Do analysis
    for (const diagnostic of [
        ...analysePreamble(context),
        ...analyseQbn(context),
        ...analyselogic(context)]) {
        diagnostics.push(diagnostic);
    }

    return diagnostics;
}

/**
 * Parses a line in the Preamble and build its diagnostic context.
 * @param line A line in the preamble.
 * @param context Context data for current diagnostics operation. 
 */
function parsePreamble(line: vscode.TextLine, context: DiagnosticContext): void {
    
    // Keyword use
    const word = parser.getFirstWord(line.text);
    if (word) {
        const result = Language.getInstance().findKeyword(word);
        if (result) {

            context.preamble.actions.push({
                line: line,
                signature: result.signature
            });

            if (!context.questName && /^\s*Quest:/.test(line.text)) {
                context.questName = line.range;
            }

            return;
        }
    }

    context.preamble.failedParse.push(line);
}

/**
 * Analyses the Preamble of a quest.
 * @param document The current open document.
 * @param context Diagnostic context for the current document.
 */
function* analysePreamble(context: DiagnosticContext): Iterable<vscode.Diagnostic> {
    for (const action of context.preamble.actions) {
        for (const diagnostic of analyseActionSignature(context, action.signature, action.line)) {
            diagnostic.source = TEMPLATE_LANGUAGE;
            yield diagnostic;
        }
    }

    for (const line of context.preamble.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'Preamble');
    }
}

function* analyselogic(context: DiagnosticContext): Iterable<vscode.Diagnostic> {
    if (context.questName) {
        if (!context.qrc.found) {
            yield Errors.blockMissing(context.questName, 'QRC');
        }
        if (!context.qbn.found) {
            yield Errors.blockMissing(context.questName, 'QBN');
        }
    }
}