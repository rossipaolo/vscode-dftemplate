/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { Diagnostic, TextLine, TextDocument, Location } from "vscode";
import { Errors, Warnings, Hints, wordRange, DiagnosticContext } from './common';
import { Language } from '../language/language';
import { TEMPLATE_LANGUAGE } from '../extension';
import { doSignatureChecks, doWordsCheck } from './signatureCheck';
import { Modules } from '../language/modules';
import { TaskType } from '../parsers/parser';

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
            for (const diagnostic of doWordsCheck(context, document, definition.matches, line)) {
                diagnostic.source = TEMPLATE_LANGUAGE;
                yield diagnostic;
            }
        }

        // Add symbol definition
        const symbolDefinition = context.qbn.symbols.get(symbol);
        if (!symbolDefinition) {
            context.qbn.symbols.set(symbol, {
                location: new Location(document.uri, wordRange(line, symbol)),
                type: type
            });
        } else if (!Array.isArray(symbolDefinition)) {
            if (symbolDefinition.location.range.start.line !== line.lineNumber) {
                context.qbn.symbols.set(symbol, [symbolDefinition, {
                    location: new Location(document.uri, wordRange(line, symbol)),
                    type: type
                }]);
            }       
        } else {
            if (!symbolDefinition.find(x => x.location.range.start.line === line.lineNumber)) {
                symbolDefinition.push({
                    location: new Location(document.uri, wordRange(line, symbol)),
                    type: type
                });
            }        
        }

        return;
    }

    // Task definition
    const task = parser.parseTaskDefinition(line.text);
    if (task) {

        if (task.type === TaskType.PersistUntil) {

            // until performed is associated to undefined task
            if (!context.qbn.tasks.has(task.symbol)) {
                yield Errors.undefinedUntilPerformed(wordRange(line, task.symbol), task.symbol);
            }

            return;
        }

        // Add symbol definition
        const taskDefinition = context.qbn.tasks.get(task.symbol);
        if (!taskDefinition) {
            context.qbn.tasks.set(task.symbol, line);
        } else if (!Array.isArray(taskDefinition)) {
            if (taskDefinition.lineNumber !== line.lineNumber) {
                context.qbn.tasks.set(task.symbol, [taskDefinition, line]);
            }       
        } else {
            if (!taskDefinition.find(x => x.lineNumber === line.lineNumber)) {
                taskDefinition.push(line);
            }        
        }

        // Unused
        if (!parser.isConditionalTask(document, line.lineNumber) && !hasAnotherOccurrence(document, line.lineNumber, task.symbol)) {
            const name = task.type === TaskType.GlobalVarLink ? task.symbol + ' from ' + task.globalVarName : task.symbol;
            yield Warnings.unusedDeclarationSymbol(wordRange(line, task.symbol), name);
        }

        // Naming convention violation
        if (!parser.symbolFollowsNamingConventions(task.symbol)) {
            yield Hints.symbolNamingConventionViolation(wordRange(line, task.symbol));
        }

        return;
    }

    // Action invocation
    const actionResult = Modules.getInstance().findAction(line.text);
    if (actionResult) {

        // Check action signature
        for (const diagnostic of doSignatureChecks(context, document, actionResult.action.overloads[actionResult.overload], line)) {
            diagnostic.source = TEMPLATE_LANGUAGE;
            yield diagnostic;
        }
    }
    else {

        // Undefined action
        yield Errors.undefinedExpression(parser.trimRange(line), 'QBN');
    }
}

export function* lateQbnCheck(document: TextDocument, context: DiagnosticContext): Iterable<Diagnostic> {

    for (const symbol of context.qbn.symbols) {

        const symbolName = symbol[0];
        const symbolContext = Array.isArray(symbol[1]) ? symbol[1][0] : symbol[1];
        if (!symbolContext) {
            continue;
        }

        // Duplicated definition
        if (Array.isArray(symbol[1])) {
            const allLocations = symbol[1].map(x => x.location);
            for (const definition of symbol[1] as parser.Symbol[]) {
                yield Errors.duplicatedDefinition(definition.location.range, symbolName, allLocations);
            }
        }

        // Unused
        if (!context.qbn.referencedSymbols.has(symbolName) &&
            parser.findSymbolReferences(document, symbolName, false)[Symbol.iterator]().next().value === undefined) { // non standard inside message blocks
            yield Warnings.unusedDeclarationSymbol(symbolContext.location.range, symbolName);
        }

        // Clock
        if (symbolContext.type === parser.Types.Clock) {
            if (!context.qbn.actions.has('start timer ' + symbolName)) {
                yield Warnings.unstartedClock(symbolContext.location.range, symbolName);
            }
            if (!context.qbn.tasks.get(symbolName)) {
                yield Warnings.unlinkedClock(symbolContext.location.range, symbolName);
            }
        }

        // Naming convention violation
        if (!parser.symbolFollowsNamingConventions(symbolName)) {
            yield Hints.symbolNamingConventionViolation(symbolContext.location.range);
        }
    }

    for (const task of context.qbn.tasks) {
        
        const taskName = task[0];
        const taskContext = Array.isArray(task[1]) ? task[1][0] : task[1];
        if (!taskContext) {
            continue;
        }

        // Duplicated definition
        if (Array.isArray(task[1])) {
            const allLocations = task[1].map(x => new Location(document.uri, x.range));
            for (const definition of task[1] as TextLine[]) {
                yield Errors.duplicatedDefinition(definition.range, taskName, allLocations);
            }
        }
    }
}

function hasAnotherOccurrence(document: TextDocument, ignored: number, symbol: string): boolean {
    return parser.firstLine(document, l => l.lineNumber !== ignored && l.text.indexOf(symbol) !== -1) !== undefined;
}