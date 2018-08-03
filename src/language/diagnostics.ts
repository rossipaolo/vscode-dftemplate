/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';

import { Range, DiagnosticSeverity } from 'vscode';
import { TEMPLATE_LANGUAGE, getOptions } from '../extension';
import { Language } from './language';
import { Modules } from './modules';

export enum DiagnosticCode {
    GenericError,
    DuplicatedMessageNumber,
    DuplicatedDefinition,
    UndefinedExpression,
    GenericWarning,
    UnusedDeclarationMessage,
    UnusedDeclarationSymbol,
    UnusedDeclarationTask,
    GenericHint,
    SymbolNamingConvention,
}

enum QuestBlock {
    Preamble,
    QRC,
    QBN
}

const Errors = {
    duplicatedMessageNumber: (range: Range, id: number) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedMessageNumber, 'Message number already in use: ' + id + '.', DiagnosticSeverity.Error),
    duplicatedDefinition: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedDefinition, name + ' is already defined.', DiagnosticSeverity.Error),
    invalidDefinition: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Invalid definition for ' + symbol + ' (' + type + ').', DiagnosticSeverity.Error),
    undefinedExpression: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Action or condition not found.', DiagnosticSeverity.Error)
};

const Warnings = {
    unusedDeclarationMessage: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationMessage, name + ' is declared but never used.', DiagnosticSeverity.Warning),
    unusedDeclarationSymbol: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + ' is declared but never used.', DiagnosticSeverity.Warning),
    unusedDeclarationTask: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationTask, name + ' is declared but never used.', DiagnosticSeverity.Warning),
    unstartedClock: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + ' is declared but never starts.', DiagnosticSeverity.Warning),
    unlinkedClock: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + " doesn't activate a task.", DiagnosticSeverity.Warning)
};

const Hints = {
    symbolNamingConventionViolation: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.SymbolNamingConvention, 'Violation of naming convention: use _symbol_.', DiagnosticSeverity.Hint),
    incorrectMessagePosition: (range: Range, current: number, previous: number) =>
        makeDiagnostic(range, DiagnosticCode.GenericHint, 'Message ' + current + ' should not be positioned after ' + previous + '.', DiagnosticSeverity.Hint)
};

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
        if (/^\s*(-.*)?$/.test(line.text)) {
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

            // Check signature
            for (const diagnostic of Language.getInstance().doDiagnostics(document, line)) {
                diagnostic.source = TEMPLATE_LANGUAGE;
                diagnostics.push(diagnostic);
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
                if (!parser.firstLine(document, l => l !== line && l.text.indexOf(messageID) !== -1)) {
                    diagnostics.push(Warnings.unusedDeclarationMessage(wordRange(line, messageID), messageID));
                }
            }

            continue;
        }
        
        if (block === QuestBlock.QBN) {

            // Symbol definition
            const symbol = parser.getSymbolFromLine(line);
            if (symbol) {

                // Invalid signature
                const text = line.text.trim();
                const type = text.substring(0, text.indexOf(' '));
                if (!Language.getInstance().findDefinition(type, text)) {
                    diagnostics.push(Errors.invalidDefinition(trimRange(line), symbol, type));
                }

                // Duplicated definition
                if (symbols.indexOf(symbol) !== - 1) {
                    diagnostics.push(Errors.duplicatedDefinition(wordRange(line, symbol), symbol));
                }
                else {
                    symbols.push(symbol);
                }

                // Unused
                if (!parser.firstLine(document, l => l !== line && l.text.indexOf(symbol) !== -1)) {
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
                
                // Duplicated definition
                if (tasks.indexOf(task) !== - 1) {
                    diagnostics.push(Errors.duplicatedDefinition(wordRange(line, task), task));
                }
                else {
                    tasks.push(task);
                }

                // Unused
                if (!isTaskUsed(document, line, task)) {
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
                if (!parser.firstLine(document, l => l !== line && l.text.indexOf(globalVar.symbol) !== -1)) {
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
            const action = Modules.getInstance().findInvokedAction(line.text);
            if (action) {

                // Check action signature
                for (const diagnostic of Modules.getInstance().doDiagnostics(document, line, action)) {
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

function isTaskUsed(document: vscode.TextDocument, line: vscode.TextLine, task: string):boolean {
    
    // Is set from another task
    if (parser.firstLine(document, l => l !== line && !/^\s*-/.test(l.text) && l.text.indexOf(task) !== -1)) {
        return true;
    }    

    // Has a condition
    if (document.lineCount > line.lineNumber + 1) {
        const text = document.lineAt(line.lineNumber + 1).text.trim();
        const space = text.indexOf(' ');
        if (space > 0) {
            const action = Modules.getInstance().findAction(text.substring(0, space), text);
            if (action && action.actionKind === Modules.ActionKind.Condition) {
                return true;
            }
        }
    }

    return false;
}

function makeDiagnostic(range: vscode.Range, code: DiagnosticCode, label: string, severity: vscode.DiagnosticSeverity)
    : vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, label, severity);
    diagnostic.code = code;
    diagnostic.source = TEMPLATE_LANGUAGE;
    return diagnostic;
}

function trimRange(line: vscode.TextLine): vscode.Range {
    return new vscode.Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex,
        line.lineNumber, line.text.replace(/\s+$/, '').length);
}

function wordRange(line: vscode.TextLine, word: string): Range {
    const index = line.text.indexOf(word);
    return new vscode.Range(line.lineNumber, index, line.lineNumber, index + word.length);
}