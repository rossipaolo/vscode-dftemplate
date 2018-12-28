/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { Diagnostic, TextLine } from "vscode";
import { Errors, Warnings, Hints, wordRange, DiagnosticContext, TaskContext, SymbolContext, findParameter } from './common';
import { Language } from '../language/language';
import { analyseSignature, parseActionSignature, parseSymbolSignature } from './signatureCheck';
import { Modules } from '../language/modules';
import { TaskType } from '../parsers/parser';
import { ParameterTypes } from '../language/parameterTypes';

/**
 * Parses a line in a QBN block and build its diagnostic context.
 * @param line A line in QBN block.
 * @param context Context data for current diagnostics operation. 
 */
export function parseQbn(line: TextLine, context: DiagnosticContext): void {

    // Symbol definition
    const symbol = parser.getSymbolFromLine(line);
    if (symbol) {
        const text = line.text.trim();
        const type = text.substring(0, text.indexOf(' '));
        const definition = Language.getInstance().findDefinition(type, text);

        const symbolDefinitionContext = {
            type: type,
            signature: definition ? parseSymbolSignature(definition.matches, line.text) : null,
            range: wordRange(line, symbol),
            line: line
        };
        const symbolDefinition = context.qbn.symbols.get(symbol);
        if (!symbolDefinition) {
            context.qbn.symbols.set(symbol, symbolDefinitionContext);
        } else if (!Array.isArray(symbolDefinition)) {
            context.qbn.symbols.set(symbol, [symbolDefinition, symbolDefinitionContext]);
        } else {
            symbolDefinition.push(symbolDefinitionContext);
        }

        return;
    }

    // Task definition
    const task = parser.parseTaskDefinition(line.text);
    if (task) {

        const newTaskDefinition = {
            range: wordRange(line, task.symbol),
            definition: task
        };

        if (task.type === TaskType.PersistUntil) {
            context.qbn.persistUntilTasks.push(newTaskDefinition);
        } else {
            const taskDefinition = context.qbn.tasks.get(task.symbol);
            if (!taskDefinition) {
                context.qbn.tasks.set(task.symbol, newTaskDefinition);
            } else if (!Array.isArray(taskDefinition)) {
                context.qbn.tasks.set(task.symbol, [taskDefinition, newTaskDefinition]);
            } else {
                taskDefinition.push(newTaskDefinition);
            }
        }

        return;
    }

    // Action invocation
    const actionResult = Modules.getInstance().findAction(line.text);
    if (actionResult) {
        context.qbn.actions.set(line.text.trim(), {
            line: line,
            signature: parseActionSignature(actionResult.action.overloads[actionResult.overload], line.text)
        });

        return;
    }

    context.qbn.failedParse.push(line);
}

/**
 * Analyses the QBN section of a quest.
 * @param document The current open document.
 * @param context Diagnostic context for the current document.
 */
export function* analyseQbn(context: DiagnosticContext): Iterable<Diagnostic> {

    for (const symbolCtx of context.qbn.symbols) {
        const symbol = symbolCtx[1];
        const symbolName = symbolCtx[0];
        const symbolContext = Array.isArray(symbol) ? symbol[0] : symbol;
        if (!symbolContext) {
            continue;
        }

        function* checkSignature(symbol: SymbolContext): Iterable<Diagnostic> {
            if (symbol.signature) {
                yield* analyseSignature(context, symbol.line, symbol.signature, false);
            }
        }

        // Invalid signature or parameters
        if (!symbolContext.signature) {
            const lineRange = parser.trimRange(symbolContext.line);
            yield Errors.invalidDefinition(lineRange, symbolName, symbolContext.type);
        }

        // Duplicated definition
        if (Array.isArray(symbol)) {
            const allLocations = symbol.map(x => context.getLocation(x.range));
            for (const symbolDefinition of symbol) {
                yield Errors.duplicatedDefinition(symbolDefinition.range, symbolName, allLocations);
            }

            for (const signature of symbol) {
                yield* checkSignature(signature);
            }
        } else {
            yield* checkSignature(symbol);
        }

        // Unused
        if (!symbolHasReferences(context, symbolName)) {
            yield Warnings.unusedDeclarationSymbol(symbolContext.range, symbolName);
        }

        // Clock
        if (symbolContext.type === parser.Types.Clock) {
            if (!context.qbn.actions.has('start timer ' + symbolName)) {
                yield Warnings.unstartedClock(symbolContext.range, symbolName);
            }
            if (!context.qbn.tasks.get(symbolName)) {
                yield Warnings.unlinkedClock(symbolContext.range, symbolName);
            }
        }

        // Naming convention violation
        if (!parser.symbolFollowsNamingConventions(symbolName)) {
            yield Hints.symbolNamingConventionViolation(symbolContext.range);
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
            const allLocations = task[1].map(x => context.getLocation(x.range));
            for (const definition of task[1] as TaskContext[]) {
                yield Errors.duplicatedDefinition(definition.range, taskName, allLocations);
            }
        }

        // Unused      
        if (!taskIsUsed(context, taskName, taskContext)) {
            const definition = taskContext.definition;
            const name = definition.type === TaskType.GlobalVarLink ? definition.symbol + ' from ' + definition.globalVarName : definition.symbol;
            yield Warnings.unusedDeclarationSymbol(taskContext.range, name);
        }

        // Naming convention violation
        if (!parser.symbolFollowsNamingConventions(taskName)) {
            yield Hints.symbolNamingConventionViolation(taskContext.range);
        }
    }

    for (const task of context.qbn.persistUntilTasks) {

        // until performed is associated to undefined task
        if (!context.qbn.tasks.has(task.definition.symbol)) {
            yield Errors.undefinedUntilPerformed(task.range, task.definition.symbol);
        }
    }

    for (const action of context.qbn.actions) {
        yield* analyseSignature(context, action[1].line, action[1].signature, true);
    }

    for (const line of context.qbn.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'QBN');
    }
}

function symbolHasReferences(context: DiagnosticContext, symbol: string): boolean {
    const baseSymbol = parser.getBaseSymbol(symbol);
    for (const action of context.qbn.actions) {
        if (action[1].signature.find(x => x.value === baseSymbol)) {
            return true;
        }
    }

    const regex = parser.makeSymbolRegex(symbol);
    if (context.qrc.messageBlocks.find(x => regex.test(x.text))) {
        return true;
    }

    return false;
}

function taskIsUsed(context: DiagnosticContext, taskName: string, taskContext: TaskContext): boolean {
    // Started by trigger
    if (parser.isConditionalTask(context.document, taskContext.range.start.line)) {
        return true;
    }

    // Started by clock
    for (const symbol of context.qbn.symbols) {
        if (symbol[0] === taskName) {
            return true;
        }
    }

    // Referenced in other tasks
    if (findParameter(context, parameter => parameter.type === ParameterTypes.task && parameter.value === taskName, false, true)) {
        return true;
    }

    return false;
}