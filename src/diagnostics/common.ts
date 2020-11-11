/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Range, DiagnosticSeverity, DiagnosticTag } from 'vscode';
import { TEMPLATE_LANGUAGE } from '../extension';
import { Parameter } from '../language/common';
import { Quest } from '../language/quest';

/**
 * Identifier code for a diagnostic item.
 */
export enum DiagnosticCode {
    GenericError,
    DuplicatedMessageNumber,
    DuplicatedDefinition,
    UndefinedExpression,
    UndefinedStaticMessage,
    UndefinedMessage,
    UndefinedContextMacro,
    UndefinedSymbol,
    UndefinedTask,
    UndefinedAttribute,
    UndefinedQuest,
    MissingPositiveSign,
    GenericWarning,
    QuestNameMismatch,
    UnusedDeclarationMessage,
    UnusedDeclarationSymbol,
    UnusedDeclarationTask,
    IncorrectSymbolVariation,
    ClockWithoutTask,
    ObsoleteAction,
    GenericHint,
    SymbolNamingConvention,
    UseAliasForStaticMessage,
    OrderMessages,
    ConvertTaskToVariable,
    ChangeStartTastToSetVar,
    ChangeSetVarToStartTask
}

export const Errors = {
    blockMissing: (range: Range, block: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Block \'' + block + '\' is missing.', DiagnosticSeverity.Error),
    notANumber: (range: Range, word: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, word + ' is not a number.', DiagnosticSeverity.Error),
    numberIsNotNatural: (range: Range, word: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Natural number doesn\'t accept a sign.', DiagnosticSeverity.Error),
    numberIsNotInteger: (range: Range, word: string) =>
        makeDiagnostic(range, DiagnosticCode.MissingPositiveSign, 'Integer number must have a sign.', DiagnosticSeverity.Error),
    duplicatedMessageNumber: (range: Range, id: number, otherDefinitions: vscode.Location[]) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedMessageNumber, 'Message number already in use: ' + id + '.', DiagnosticSeverity.Error,
        { locations: otherDefinitions, label: 'message definition' }),
    duplicatedDefinition: (range: Range, name: string, otherDefinitions?: vscode.Location[]) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedDefinition, name + ' is already defined.', DiagnosticSeverity.Error,
            otherDefinitions ? { locations: otherDefinitions, label: 'symbol definition' } : undefined),
    invalidDefinition: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Invalid definition for ' + symbol + ' (' + type + ').', DiagnosticSeverity.Error),
    invalidStaticMessageDefinition: (range: Range, id: number, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedStaticMessage, '\'' + name + '\' is not a valid alias for message ' + id + '.', DiagnosticSeverity.Error),
    undefinedMessage: (range: Range, message: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedMessage, 'Reference to undefined message: ' + message + '.', DiagnosticSeverity.Error),
    undefinedContextMacro: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedContextMacro, 'Reference to undefined symbol: ' + symbol + '.', DiagnosticSeverity.Error),
    undefinedSymbol: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedSymbol, 'Reference to undefined symbol: ' + symbol + '.', DiagnosticSeverity.Error),
    undefinedTask: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedTask, 'Reference to undefined task: ' + symbol + '.', DiagnosticSeverity.Error),
    undefinedQuest: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedQuest, 'Reference to undefined quest: ' + name + '.', DiagnosticSeverity.Error),
    undefinedAttribute: (range: Range, name: string, group: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedAttribute, "The name '" + name + "' doesn't exist in the attribute group '" + group + "'.", DiagnosticSeverity.Error),
    undefinedExpression: (range: Range, block: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Undefined expression inside block \'' + block + '\'.', DiagnosticSeverity.Error),
    undefinedUntilPerformed: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Task execution is based on another task which is not defined: ' + symbol + '.', DiagnosticSeverity.Error),
    incorrectTime: (range: Range, time: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, time + ' is not in 24-hour format (00:00 to 23:59).', DiagnosticSeverity.Error),
    incorrectSymbolType: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Incorrect symbol type: ' + symbol + ' is not declared as ' + type + '.', DiagnosticSeverity.Error),
    schemaMismatch: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Table entry does not implement schema.', DiagnosticSeverity.Error)
};

export const Warnings = {
    questNameMismatch: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.QuestNameMismatch, 'Quest name should be equal to file name; A readable longer name can be provided with DisplayName.', DiagnosticSeverity.Warning),
    unusedDeclarationMessage: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationMessage, name + ' is declared but never used.', DiagnosticSeverity.Warning, undefined, [DiagnosticTag.Unnecessary]),
    unusedDeclarationSymbol: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + ' is declared but never used.', DiagnosticSeverity.Warning, undefined, [DiagnosticTag.Unnecessary]),
    unusedDeclarationTask: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationTask, name + ' is declared but never used.', DiagnosticSeverity.Warning, undefined, [DiagnosticTag.Unnecessary]),
    unstartedClock: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + ' is declared but never starts.', DiagnosticSeverity.Warning, undefined, [DiagnosticTag.Unnecessary]),
    unlinkedClock: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.ClockWithoutTask, name + " doesn't activate a task.", DiagnosticSeverity.Warning),
    incorrectSymbolVariation: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.IncorrectSymbolVariation, symbol + " is not a valid variation for type '" + type + "'.", DiagnosticSeverity.Warning)
};

export const Informations = {
    obsoleteAction: (range: Range, fullName: string) =>
        makeDiagnostic(range, DiagnosticCode.ObsoleteAction, `'${fullName}' is obsolete.`, DiagnosticSeverity.Information, undefined, [DiagnosticTag.Deprecated])
};

export const Hints = {
    symbolNamingConventionViolation: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.SymbolNamingConvention, 'Violation of naming convention: use _symbol_.', DiagnosticSeverity.Hint),
    useAliasForStaticMessage: (range: Range, messageID: number) =>
        makeDiagnostic(range, DiagnosticCode.UseAliasForStaticMessage, 'Use text alias for static message ' + messageID + '.', DiagnosticSeverity.Hint),
    incorrectMessagePosition: (range: Range, current: number, previous: number, previousLocation: vscode.Location) =>
        makeDiagnostic(range, DiagnosticCode.OrderMessages, 'Message ' + current + ' should not be positioned after ' + previous + '.', DiagnosticSeverity.Hint,
            { locations: [previousLocation], label: 'message ' + previous }),
    changeSymbolVariation: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.IncorrectSymbolVariation, 'Symbol variation can be changed.', DiagnosticSeverity.Hint),
    convertTaskToVariable: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.ConvertTaskToVariable, 'Empty task can be converted to variable.', DiagnosticSeverity.Hint),
    changeStartTaskToSetVar: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.ChangeStartTastToSetVar, 'Variable can be activated with setvar.', DiagnosticSeverity.Hint),
    changeSetVarToStartTask: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.ChangeSetVarToStartTask, 'Task can be activated with start task.', DiagnosticSeverity.Hint)
};

/**
* Checks if any symbol or action invocations has a parameter that matches `filter`.
* @param context Diagnostic context for the current document.
* @param filter A callback that filters the parameters.
* @param symbols Seek inside symbols definitions?
* @param actions Seek inside actions invocations?
*/
export function findParameter(context: Quest, filter: (parameter: Parameter) => boolean, symbols: boolean = true, actions: boolean = true): boolean {
    if (actions) {
        for (const action of context.qbn.iterateActions()) {
            if (action.signature.find(x => filter(x))) {
                return true;
            }
        }
    }

    if (symbols) {
        for (const symbol of context.qbn.symbols.values()) {
            if (symbol) {
                const signature = Array.isArray(symbol) ? symbol[0].signature : symbol.signature;
                if (signature && signature.find(x => filter(x))) {
                    return true;
                }
            }
        }
    }

    return false;
}

function makeDiagnostic(range: vscode.Range, code: DiagnosticCode, label: string, severity: vscode.DiagnosticSeverity, relatedInformation?: { locations: vscode.Location[], label: string }, tags?: DiagnosticTag[]): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, label, severity);
    diagnostic.code = code;
    diagnostic.tags = tags;

    if (relatedInformation) {
        diagnostic.relatedInformation = relatedInformation.locations.map(x => new vscode.DiagnosticRelatedInformation(x, relatedInformation.label));
    }

    diagnostic.source = TEMPLATE_LANGUAGE;
    return diagnostic;
}