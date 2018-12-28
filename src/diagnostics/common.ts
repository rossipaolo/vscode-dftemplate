/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { Range, DiagnosticSeverity } from 'vscode';
import { TEMPLATE_LANGUAGE } from '../extension';
import { TaskDefinition } from '../parsers/parser';
import { Parameter } from './signatureCheck';

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
    UseAliasForStaticMessage
}

export const Errors = {
    blockMissing: (range: Range, block: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Block \'' + block + '\' is missing.', DiagnosticSeverity.Error),
    notANumber: (range: Range, word: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, word + ' is not a number.', DiagnosticSeverity.Error),
    numberIsNotNatural: (range: Range, word: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Natural number doesn\'t accept a sign.', DiagnosticSeverity.Error),
    numberIsNotInteger: (range: Range, word: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Integer number must have a sign.', DiagnosticSeverity.Error),
    duplicatedMessageNumber: (range: Range, id: number, otherDefinitions: vscode.Location[]) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedMessageNumber, 'Message number already in use: ' + id + '.', DiagnosticSeverity.Error,
        { locations: otherDefinitions, label: 'message definition' }),
    duplicatedDefinition: (range: Range, name: string, otherDefinitions?: vscode.Location[]) =>
        makeDiagnostic(range, DiagnosticCode.DuplicatedDefinition, name + ' is already defined.', DiagnosticSeverity.Error,
            otherDefinitions ? { locations: otherDefinitions, label: 'symbol definition' } : undefined),
    invalidDefinition: (range: Range, symbol: string, type: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Invalid definition for ' + symbol + ' (' + type + ').', DiagnosticSeverity.Error),
    invalidStaticMessageDefinition: (range: Range, id: number, name: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, '\'' + name + '\' is not a valid alias for message ' + id + '.', DiagnosticSeverity.Error),
    undefinedMessage: (range: Range, message: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Reference to undefined message: ' + message + '.', DiagnosticSeverity.Error),
    undefinedSymbol: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.UndefinedExpression, 'Reference to undefined symbol: ' + symbol + '.', DiagnosticSeverity.Error),
    undefinedTask: (range: Range, symbol: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, 'Reference to undefined task: ' + symbol + '.', DiagnosticSeverity.Error),
    undefinedAttribute: (range: Range, name: string, group: string) =>
        makeDiagnostic(range, DiagnosticCode.GenericError, "The name '" + name + "' doesn't exist in the attribute group '" + group + "'.", DiagnosticSeverity.Error),
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
    useAliasForStaticMessage: (range: Range, messageID: number) =>
        makeDiagnostic(range, DiagnosticCode.UseAliasForStaticMessage, 'Use text alias for static message ' + messageID + '.', DiagnosticSeverity.Hint),
    incorrectMessagePosition: (range: Range, current: number, previous: number, previousLocation: vscode.Location) =>
        makeDiagnostic(range, DiagnosticCode.GenericHint, 'Message ' + current + ' should not be positioned after ' + previous + '.', DiagnosticSeverity.Hint,
            { locations: [previousLocation], label: 'message ' + previous }),
    SymbolVariation: (range: Range) =>
        makeDiagnostic(range, DiagnosticCode.IncorrectSymbolVariation, '', DiagnosticSeverity.Hint)
};

export interface SymbolContext {
    type: string;
    signature: Parameter[] | null;
    range: Range;
    line: vscode.TextLine;
}

export interface TaskContext {
    range: vscode.Range;
    definition: TaskDefinition;
}

export interface ActionContext {
    line: vscode.TextLine;
    signature: Parameter[];
}

export interface MessageContext {
    id: number;
    alias: string | undefined;
    range: vscode.Range;
    otherRanges: vscode.Range[] | undefined;
}

abstract class BlockContext {
    public found: boolean = false;
    public readonly failedParse: vscode.TextLine[] = [];
}

class PreambleContext extends BlockContext {
    public questName: vscode.Range | null = null;
    public readonly actions: ActionContext[] = [];
}

class QrcContext extends BlockContext {
    public readonly messages: MessageContext[] = [];
    public readonly messageBlocks: vscode.TextLine[] = [];
    public messageBlock: parser.MessageBlock | null = null;
}

class QbnContext extends BlockContext {
    public readonly symbols = new Map<string, SymbolContext | SymbolContext[]>();
    public readonly tasks = new Map<string, TaskContext | TaskContext[]>();
    public readonly persistUntilTasks: TaskContext[] = [];
    public readonly actions = new Map<string, ActionContext>();
}

export class DiagnosticContext {
    public readonly preamble = new PreambleContext();
    public readonly qrc = new QrcContext();
    public readonly qbn = new QbnContext();

    public constructor(public readonly document: vscode.TextDocument) {
    }

    public getLocation(range: Range): vscode.Location {
        return new vscode.Location(this.document.uri, range);
    }
}

export function wordRange(line: vscode.TextLine, word: string): Range {
    const index = line.text.indexOf(word);
    return new vscode.Range(line.lineNumber, index, line.lineNumber, index + word.length);
}

/**
* Checks if any symbol or action invocations has a parameter that matches `filter`.
* @param context Diagnostic context for the current document.
* @param filter A callback that filters the parameters.
* @param symbols Seek inside symbols definitions?
* @param actions Seek inside actions invocations?
*/
export function findParameter(context: DiagnosticContext, filter: (parameter: Parameter) => boolean, symbols: boolean = true, actions: boolean = true): boolean {
    if (actions) {
        for (const action of context.qbn.actions) {
            if (action[1].signature.find(x => filter(x))) {
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

function makeDiagnostic(range: vscode.Range, code: DiagnosticCode, label: string, severity: vscode.DiagnosticSeverity, relatedInformation?: { locations: vscode.Location[], label: string }): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(range, label, severity);
    diagnostic.code = code;
    if (code === DiagnosticCode.UnusedDeclarationMessage || code === DiagnosticCode.UnusedDeclarationSymbol || code === DiagnosticCode.UnusedDeclarationTask) {
        diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    
    }
    if (relatedInformation) {
        diagnostic.relatedInformation = relatedInformation.locations.map(x => new vscode.DiagnosticRelatedInformation(x, relatedInformation.label));
    }
    diagnostic.source = TEMPLATE_LANGUAGE;
    return diagnostic;
}