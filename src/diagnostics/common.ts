/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { Range, DiagnosticSeverity } from 'vscode';
import { TEMPLATE_LANGUAGE } from '../extension';

/**
 * Placeholders for snippets.
 */
export abstract class SignatureWords {
    public static readonly number = '${dd}';
    public static readonly time = '${hh}:${mm}';
    public static readonly questID = '${questID}';
    public static readonly questName = '${questName}';
    public static readonly message = '${message}';
    public static readonly messageID = '${messageID}';
    public static readonly messageName = '${messageName}';
    public static readonly symbol = '${_symbol_}';
    public static readonly clockSymbol = '${_clock_}';
    public static readonly foeSymbol = '${_foe_}';
    public static readonly itemSymbol = '${_item_}';
    public static readonly personSymbol = '${_person_}';
    public static readonly placeSymbol = '${_place_}';
    public static readonly task = '${task}';
    public static readonly disease = '${disease}';
    public static readonly faction = '${faction}';
    public static readonly factionType = '${factionType}';
    public static readonly group = '${group}';
    public static readonly foe = '${foe}';
    public static readonly commonItem = '${commonItem}';
    public static readonly artifactItem = '${artifactItem}';
    public static readonly localRemotePlace = '${localRemotePlace}';
    public static readonly permanentPlace = '${permanentPlace}';
    public static readonly sound = '${sound}';
}

/**
 * Identifier code for a diagnostic item.
 */
export enum DiagnosticCode {
    GenericError,
    DuplicatedMessageNumber,
    DuplicatedDefinition,
    UndefinedExpression,
    GenericWarning,
    UnusedDeclarationMessage,
    UnusedDeclarationSymbol,
    UnusedDeclarationTask,
    IncorrectSymbolVariation,
    GenericHint,
    SymbolNamingConvention,
}

export const Errors = {
    notANumber: (range: Range, word: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, word + ' is not a number.', DiagnosticSeverity.Error),
    duplicatedMessageNumber: (range: Range, id: number) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedMessageNumber, 'Message number already in use: ' + id + '.', DiagnosticSeverity.Error),
    duplicatedDefinition: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedDefinition, name + ' is already defined.', DiagnosticSeverity.Error),
    invalidDefinition: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Invalid definition for ' + symbol + ' (' + type + ').', DiagnosticSeverity.Error),
    undefinedMessage: (range: Range, message: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Reference to undefined message: ' + message + '.', DiagnosticSeverity.Error),
    undefinedSymbol: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Reference to undefined symbol: ' + symbol + '.', DiagnosticSeverity.Error),
    undefinedTask: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Reference to undefined task: ' + symbol + '.', DiagnosticSeverity.Error),
    undefinedAttribute: (range: Range, name: string, group: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, "The name '" + name + "' doesn't exist in the attribute group '" + group + "'.", DiagnosticSeverity.Error),
    undefinedExpression: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Action or condition not found.', DiagnosticSeverity.Error),
    undefinedUntilPerformed: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Task execution is based on another task which is not defined: ' + symbol + '.', DiagnosticSeverity.Error),
    incorrectTime: (range: Range, time: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, time + ' is not in 24-hour format (00:00 to 23:59).', DiagnosticSeverity.Error),
    incorrectSymbolType: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Incorrect symbol type: ' + symbol + ' is not declared as ' + type + '.', DiagnosticSeverity.Error)
};

export const Warnings = {
    unusedDeclarationMessage: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationMessage, name + ' is declared but never used.', DiagnosticSeverity.Warning),
    unusedDeclarationSymbol: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + ' is declared but never used.', DiagnosticSeverity.Warning),
    unusedDeclarationTask: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationTask, name + ' is declared but never used.', DiagnosticSeverity.Warning),
    unstartedClock: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + ' is declared but never starts.', DiagnosticSeverity.Warning),
    unlinkedClock: (range: Range, name: string) =>
        makeDiagnostic(range, DiagnosticCode.UnusedDeclarationSymbol, name + " doesn't activate a task.", DiagnosticSeverity.Warning),
    incorrectSymbolVariation: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.IncorrectSymbolVariation, symbol + " is not a valid variation for type '" + type + "'.", DiagnosticSeverity.Warning)
};

export const Hints = {
    symbolNamingConventionViolation: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.SymbolNamingConvention, 'Violation of naming convention: use _symbol_.', DiagnosticSeverity.Hint),
    incorrectMessagePosition: (range: Range, current: number, previous: number) =>
        makeDiagnostic(range, DiagnosticCode.GenericHint, 'Message ' + current + ' should not be positioned after ' + previous + '.', DiagnosticSeverity.Hint),
    SymbolVariation: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.IncorrectSymbolVariation, '', DiagnosticSeverity.Hint)
};

function makeDiagnostic(range: vscode.Range, code: DiagnosticCode, label: string, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, label, severity);
    diagnostic.code = code;
    if (code === DiagnosticCode.UnusedDeclarationMessage || code === DiagnosticCode.UnusedDeclarationSymbol || code === DiagnosticCode.UnusedDeclarationTask) {
        diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    }
    diagnostic.source = TEMPLATE_LANGUAGE;
    return diagnostic;
}