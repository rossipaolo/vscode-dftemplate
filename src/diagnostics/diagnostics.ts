/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TEMPLATE_LANGUAGE, getOptions } from '../extension';
import { Errors } from './common';
import { analysePreamble } from './preambleCheck';
import { analyseQrc } from './qrcCheck';
import { analyseQbn } from './qbnCheck';
import { tableCheck } from './tableCheck';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Quest } from '../language/quest';
import { Language } from '../language/static/language';
import { Quests } from '../language/quests';

let timer: NodeJS.Timer | null = null;

/**
 * Makes a diagnostic collection and subscribes to events for diagnostic.
 * @param context Extension context.
 */
export function makeDiagnosticCollection(context: vscode.ExtensionContext, language: Language, quests: Quests): vscode.DiagnosticCollection {

    const diagnosticsOption = getOptions()['diagnostics'];
    const liveDiagnostics = diagnosticsOption['live'];
    const delay = diagnosticsOption['delay'];
    const diagnosticCollection = vscode.languages.createDiagnosticCollection(TEMPLATE_LANGUAGE);

    // Do diagnostics for current file
    if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        if (document.languageId === TEMPLATE_LANGUAGE) {
            updateDiagnostics(diagnosticCollection, document, language, quests);
        }
    }

    // Do diagnostics for opened files
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === TEMPLATE_LANGUAGE) {
            updateDiagnostics(diagnosticCollection, document, language, quests);
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
                    updateDiagnostics(diagnosticCollection, e.document, language, quests);
                    timer = null;
                }, delay);
            }
        }));
    }
    else {

        // Do diagnostics only on save
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === TEMPLATE_LANGUAGE) {
                updateDiagnostics(diagnosticCollection, document, language, quests);
            }
        }));
    }

    return diagnosticCollection;
}

/**
 * Makes diagostics for the given document.
 */
async function updateDiagnostics(diagnosticCollection: vscode.DiagnosticCollection, document: vscode.TextDocument, language: Language, quests: Quests): Promise<void> {
    let diagnostics: vscode.Diagnostic[];

    if (Quest.isTable(document.uri)) {

        // Analyse table
        diagnostics = Array.from(tableCheck(document));
    } else {

        // Analyse quest
        const context = quests.get(document);
        diagnostics = [
            ...analysePreamble(context),
            ...(context.qrc.found ? analyseQrc(context,language) : failedAnalysis(context, 'QRC')),
            ...(context.qbn.found ? analyseQbn(context) : failedAnalysis(context, 'QBN')),
        ];
        await analyseQuestReferences(context, diagnostics, quests);
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Checks references to quests from task actions and ensures they point to quests available in the workspace.
 * @param context The document to build diagnostics for.
 * @param diagnostics The array where diagnostics are pushed.
 */
async function analyseQuestReferences(context: Quest, diagnostics: vscode.Diagnostic[], quests: Quests): Promise<void> {
    let cachedQuests: Quest[] | undefined;
    for (const action of context.qbn.iterateActions()) {
        const index = action.signature.findIndex(x => x.type === ParameterTypes.questName || x.type === ParameterTypes.questID);
        if (index !== -1) {
            if (cachedQuests === undefined) {
                cachedQuests = await quests.getAll();
            }

            const name = Quest.indexToName(action.signature[index].value);
            if (!cachedQuests.find(x => x.getName() === name)) {
                diagnostics.push(Errors.undefinedQuest(action.getRange(index), name));
            }
        }
    }
}

function* failedAnalysis(context: Quest, name: string): Iterable<vscode.Diagnostic> {
    const questName = context.preamble.questName;
    if (questName) {
        yield Errors.blockMissing(questName.range, name);
    }
}