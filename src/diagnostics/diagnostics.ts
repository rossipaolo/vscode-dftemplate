/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../language/parser';

import { Range } from 'vscode';
import { TEMPLATE_LANGUAGE, getOptions } from '../extension';
import { Language } from '../language/language';
import { Modules } from '../language/modules';
import { doSignatureChecks, doWordsCheck } from './signatureCheck';
import { Hints, Errors, Warnings } from './common';

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
    const diagnostics: vscode.Diagnostic[] = [];
    let block = QuestBlock.Preamble;

    const messages: number[] = [];
    const symbols: string[] = [];
    const tasks: string[] = [];

    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);

        // Skip comments and empty lines
        if (parser.isEmptyOrComment(line.text)) {
            continue;
        }

        // Detect next block
        if (line.text.indexOf('QRC:') !== -1) {
            block = QuestBlock.QRC;
            continue;
        }
        else if (line.text.indexOf('QBN:') !== -1) {
            block = QuestBlock.QBN;
            continue;
        }

        if (block === QuestBlock.Preamble) {

            const word = parser.getFirstWord(line.text);
            if (word) {

                // Check signature
                const result = Language.getInstance().findKeyword(word);
                if (result) {
                    for (const diagnostic of doSignatureChecks(document, result.signature, line)) {
                        diagnostic.source = TEMPLATE_LANGUAGE;
                        diagnostics.push(diagnostic);
                    }
                }
            }

            continue;
        }

        if (block === QuestBlock.QRC) {

            // Message definition
            const messageID = parser.getMessageIDFromLine(line);
            if (messageID) {
                const id = Number(messageID);

                // Incorrect position
                if (id < messages[messages.length - 1]) {
                    diagnostics.push(Hints.incorrectMessagePosition(wordRange(line, messageID), id, messages[messages.length - 1]));
                }

                // Duplicated definition
                if (messages.indexOf(id) !== -1) {
                    diagnostics.push(Errors.duplicatedMessageNumber(wordRange(line, messageID), id));
                }
                else {
                    messages.push(id);
                }

                // Unused
                if (parser.findMessageReferences(document, messageID, false)[Symbol.iterator]().next().value === undefined) {
                    diagnostics.push(Warnings.unusedDeclarationMessage(wordRange(line, messageID), messageID));
                }
            }

            // Symbol occurrences
            const symbols = parser.findAllSymbolsInALine(line.text);
            if (symbols) {
                for (const symbol of symbols) {
                    const definition = parser.findSymbolDefinition(document, symbol);
                    if (!definition) {
                        diagnostics.push(Errors.undefinedSymbol(wordRange(line, symbol), symbol));
                    }
                    else if (!parser.isSupportedSymbolVariation(symbol, definition.type)) {
                        diagnostics.push(Warnings.incorrectSymbolVariation(wordRange(line, symbol), symbol, definition.type));
                    }
                    else {
                        diagnostics.push(Hints.SymbolVariation(wordRange(line, symbol)));
                    }
                }
            }

            continue;
        }

        if (block === QuestBlock.QBN) {

            // Symbol definition
            const symbol = parser.getSymbolFromLine(line);
            if (symbol) {
                const text = line.text.trim();
                const type = text.substring(0, text.indexOf(' '));
                const definition = Language.getInstance().findDefinition(type, text);

                // Invalid signature or parameters
                if (!definition) {
                    diagnostics.push(Errors.invalidDefinition(trimRange(line), symbol, type));
                }
                else if (definition.matches) {
                    for (const diagnostic of doWordsCheck(document, definition.matches, line)) {
                        diagnostic.source = TEMPLATE_LANGUAGE;
                        diagnostics.push(diagnostic);
                    }
                }

                // Duplicated definition
                if (symbols.indexOf(symbol) !== - 1) {
                    diagnostics.push(Errors.duplicatedDefinition(wordRange(line, symbol), symbol));
                }
                else {
                    symbols.push(symbol);
                }

                // Unused
                if (!hasAnotherOccurrence(document, line.lineNumber, symbol)) {
                    diagnostics.push(Warnings.unusedDeclarationSymbol(wordRange(line, symbol), symbol));
                }

                // Naming convention violation
                if (!parser.symbolFollowsNamingConventions(symbol)) {
                    diagnostics.push(Hints.symbolNamingConventionViolation(wordRange(line, symbol)));
                }

                if (type === parser.Types.Clock) {
                    if (!parser.findLine(document, new RegExp('start timer ' + symbol))) {
                        diagnostics.push(Warnings.unstartedClock(wordRange(line, symbol), symbol));
                    }
                    if (!parser.findTaskDefinition(document, symbol)) {
                        diagnostics.push(Warnings.unlinkedClock(wordRange(line, symbol), symbol));
                    }
                }

                continue;
            }

            // Task definition
            const task = parser.getTaskName(line.text);
            if (task) {

                if (/^\s*until\s/.test(line.text)) {

                    // until performed is associated to undefined task
                    if (tasks.indexOf(task) === - 1) {
                        diagnostics.push(Errors.undefinedUntilPerformed(wordRange(line, task), task));
                    }

                    continue;
                }

                // Duplicated definition
                if (tasks.indexOf(task) !== - 1) {
                    diagnostics.push(Errors.duplicatedDefinition(wordRange(line, task), task));
                }
                else {
                    tasks.push(task);
                }

                // Unused
                if (!parser.isConditionalTask(document, line.lineNumber) && !hasAnotherOccurrence(document, line.lineNumber, task)) {
                    diagnostics.push(Warnings.unusedDeclarationTask(wordRange(line, task), task));
                }

                // Naming convention violation
                if (!parser.symbolFollowsNamingConventions(task)) {
                    diagnostics.push(Hints.symbolNamingConventionViolation(wordRange(line, task)));
                }

                continue;
            }

            // Global variables
            const globalVar = parser.getGlobalVariable(line.text);
            if (globalVar) {

                // Duplicated definition
                if (tasks.indexOf(globalVar.symbol) !== - 1) {
                    diagnostics.push(Errors.duplicatedDefinition(wordRange(line, globalVar.symbol), globalVar.symbol));
                }
                else {
                    tasks.push(globalVar.symbol);
                }

                // Unused
                if (!hasAnotherOccurrence(document, line.lineNumber, globalVar.symbol)) {
                    const name = globalVar.symbol + ' from ' + globalVar.name;
                    diagnostics.push(Warnings.unusedDeclarationSymbol(wordRange(line, globalVar.symbol), name));
                }

                // Naming convention violation
                if (!parser.symbolFollowsNamingConventions(globalVar.symbol)) {
                    diagnostics.push(Hints.symbolNamingConventionViolation(wordRange(line, globalVar.symbol)));
                }

                continue;
            }

            // Action invokation
            const actionResult = Modules.getInstance().findInvokedAction(line.text);
            if (actionResult) {

                // Check action signature
                for (const diagnostic of doSignatureChecks(document, actionResult.action.overloads[actionResult.overload], line)) {
                    diagnostic.source = TEMPLATE_LANGUAGE;
                    diagnostics.push(diagnostic);
                }
            }
            else {

                // Undefined action
                diagnostics.push(Errors.undefinedExpression(trimRange(line)));
            }
        }
    }

    return diagnostics;
}

function hasAnotherOccurrence(document: vscode.TextDocument, ignored: number, symbol: string): boolean {
    return parser.firstLine(document, l => l.lineNumber !== ignored && l.text.indexOf(symbol) !== -1) !== undefined;
}

function trimRange(line: vscode.TextLine): vscode.Range {
    return new vscode.Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex,
        line.lineNumber, line.text.replace(/\s+$/, '').length);
}

function wordRange(line: vscode.TextLine, word: string): Range {
    const index = line.text.indexOf(word);
    return new vscode.Range(line.lineNumber, index, line.lineNumber, index + word.length);
}