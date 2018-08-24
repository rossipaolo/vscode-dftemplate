/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { Diagnostic, TextLine, TextDocument } from "vscode";
import { Errors, Warnings, Hints, wordRange } from './common';
import { Language } from '../language/language';
import { TEMPLATE_LANGUAGE } from '../extension';
import { doSignatureChecks, doWordsCheck } from './signatureCheck';
import { Modules } from '../language/modules';
import { DiagnosticContext } from './diagnostics';

/**
 * Do diagnostics for a line in a QBN block.
 *  * @param document A quest document.
 * @param line A line in QBN block.
 * @param context Context data for current diagnostics operation. 
 */
export function* qbnCheck(document: TextDocument, line: TextLine, context: DiagnosticContext): Iterable<Diagnostic> {

    // Symbol definition
    const symbol = parser.getSymbolFromLine(line);
    if (symbol) {
        const text = line.text.trim();
        const type = text.substring(0, text.indexOf(' '));
        const definition = Language.getInstance().findDefinition(type, text);

        // Invalid signature or parameters
        if (!definition) {
            yield Errors.invalidDefinition(parser.trimRange(line), symbol, type);
        }
        else if (definition.matches) {
            for (const diagnostic of doWordsCheck(document, definition.matches, line)) {
                diagnostic.source = TEMPLATE_LANGUAGE;
                yield diagnostic;
            }
        }

        // Duplicated definition
        if (context.symbols.indexOf(symbol) !== - 1) {
            yield Errors.duplicatedDefinition(wordRange(line, symbol), symbol);
        }
        else {
            context.symbols.push(symbol);
        }

        // Unused
        if (parser.findSymbolReferences(document, symbol, false)[Symbol.iterator]().next().value === undefined) {
            yield Warnings.unusedDeclarationSymbol(wordRange(line, symbol), symbol);
        }

        // Naming convention violation
        if (!parser.symbolFollowsNamingConventions(symbol)) {
            yield Hints.symbolNamingConventionViolation(wordRange(line, symbol));
        }

        if (type === parser.Types.Clock) {
            if (!parser.findLine(document, new RegExp('start timer ' + symbol))) {
                yield Warnings.unstartedClock(wordRange(line, symbol), symbol);
            }
            if (!parser.findTaskDefinition(document, symbol)) {
                yield Warnings.unlinkedClock(wordRange(line, symbol), symbol);
            }
        }

        return;
    }

    // Task definition
    const task = parser.getTaskName(line.text);
    if (task) {

        if (/^\s*until\s/.test(line.text)) {

            // until performed is associated to undefined task
            if (context.tasks.indexOf(task) === - 1) {
                yield Errors.undefinedUntilPerformed(wordRange(line, task), task);
            }

            return;
        }

        // Duplicated definition
        if (context.tasks.indexOf(task) !== - 1) {
            yield Errors.duplicatedDefinition(wordRange(line, task), task);
        }
        else {
            context.tasks.push(task);
        }

        // Unused
        if (!parser.isConditionalTask(document, line.lineNumber) && !hasAnotherOccurrence(document, line.lineNumber, task)) {
            yield Warnings.unusedDeclarationTask(wordRange(line, task), task);
        }

        // Naming convention violation
        if (!parser.symbolFollowsNamingConventions(task)) {
            yield Hints.symbolNamingConventionViolation(wordRange(line, task));
        }

        return;
    }

    // Global variables
    const globalVar = parser.getGlobalVariable(line.text);
    if (globalVar) {

        // Duplicated definition
        if (context.tasks.indexOf(globalVar.symbol) !== - 1) {
            yield Errors.duplicatedDefinition(wordRange(line, globalVar.symbol), globalVar.symbol);
        }
        else {
            context.tasks.push(globalVar.symbol);
        }

        // Unused
        if (!hasAnotherOccurrence(document, line.lineNumber, globalVar.symbol)) {
            const name = globalVar.symbol + ' from ' + globalVar.name;
            yield Warnings.unusedDeclarationSymbol(wordRange(line, globalVar.symbol), name);
        }

        // Naming convention violation
        if (!parser.symbolFollowsNamingConventions(globalVar.symbol)) {
            yield Hints.symbolNamingConventionViolation(wordRange(line, globalVar.symbol));
        }

        return;
    }

    // Action invocation
    const actionResult = Modules.getInstance().findAction(line.text);
    if (actionResult) {

        // Check action signature
        for (const diagnostic of doSignatureChecks(document, actionResult.action.overloads[actionResult.overload], line)) {
            diagnostic.source = TEMPLATE_LANGUAGE;
            yield diagnostic;
        }
    }
    else {

        // Undefined action
        yield Errors.undefinedExpression(parser.trimRange(line), 'QBN');
    }
}

function hasAnotherOccurrence(document: TextDocument, ignored: number, symbol: string): boolean {
    return parser.firstLine(document, l => l.lineNumber !== ignored && l.text.indexOf(symbol) !== -1) !== undefined;
}