/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { Diagnostic } from 'vscode';
import { Errors, Warnings, Hints, findParameter } from './common';
import { analyseSignature } from './signatureCheck';
import { SymbolType } from '../language/static/common';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Modules } from '../language/static/modules';
import { LanguageData } from '../language/static/languageData';
import { Quest } from '../language/quest';
import { Symbol, Task } from '../language/common';
import { first, getOptions } from '../extension';

/**
 * Analyses the QBN section of a quest.
 * @param document The current open document.
 * @param context Diagnostic context for the current document.
 * @param data Language data used for linting.
 */
export function* analyseQbn(context: Quest, data: LanguageData): Iterable<Diagnostic> {

    for (const [name, symbols] of context.qbn.symbols) {

        const firstSymbol = Array.isArray(symbols) ? symbols[0] : symbols;
        if (!firstSymbol) {
            continue;
        }

        function* checkSignature(symbol: Symbol): Iterable<Diagnostic> {
            if (symbol.signature) {
                yield* analyseSignature(context, data, symbol.line, symbol.signature, false);
            }
        }

        // Invalid signature or parameters
        if (!firstSymbol.signature) {
            const lineRange = parser.trimRange(firstSymbol.line);
            yield Errors.invalidDefinition(lineRange, name, firstSymbol.type);
        }

        // Duplicated definition
        if (Array.isArray(symbols)) {
            const allLocations = symbols.map(x => context.getLocation(x.range));
            for (const symbolDefinition of symbols) {
                yield Errors.duplicatedDefinition(symbolDefinition.range, name, allLocations);
            }

            for (const signature of symbols) {
                yield* checkSignature(signature);
            }
        } else {
            yield* checkSignature(symbols);
        }

        // Unused
        if (!symbolHasReferences(context, name)) {
            yield Warnings.unusedDeclarationSymbol(firstSymbol.range, name);
        }

        // Clock
        if (firstSymbol.type === SymbolType.Clock) {
            if (!first(context.qbn.iterateActions(), x => x.line.text.indexOf('start timer ' + name) !== -1)) {
                yield Warnings.unstartedClock(firstSymbol.range, name);
            }
            if (!context.qbn.tasks.get(name)) {
                yield Warnings.unlinkedClock(firstSymbol.range, name);
            }
        }

        // Naming convention violation
        if (!parser.symbols.symbolFollowsNamingConventions(name)) {
            yield Hints.symbolNamingConventionViolation(firstSymbol.range);
        }
    }

    for (const [name, tasks] of context.qbn.tasks) {
        
        const firstTask = Array.isArray(tasks) ? tasks[0] : tasks;
        if (!firstTask) {
            continue;
        }

        // Duplicated definition
        if (Array.isArray(tasks)) {
            const allLocations = tasks.map(x => context.getLocation(x.range));
            for (const definition of tasks) {
                yield Errors.duplicatedDefinition(definition.range, name, allLocations);
            }
        }

        // Unused      
        if (!taskIsUsed(context, name, firstTask, data.modules)) {
            const definition = firstTask.definition;
            const name = definition.type === parser.tasks.TaskType.GlobalVarLink ? definition.symbol + ' from ' + definition.globalVarName : definition.symbol;
            yield Warnings.unusedDeclarationTask(firstTask.range, name);
        }

        // Naming convention violation
        if (!parser.symbols.symbolFollowsNamingConventions(name)) {
            yield Hints.symbolNamingConventionViolation(firstTask.range);
        }

        // Convert to variable
        if (firstTask.actions.length === 0 && !firstTask.isVariable) {
            yield Hints.convertTaskToVariable(firstTask.range);
        }
    }

    for (const task of context.qbn.persistUntilTasks) {

        // until performed is associated to undefined task
        if (!context.qbn.tasks.has(task.definition.symbol)) {
            yield Errors.undefinedUntilPerformed(task.range, task.definition.symbol);
        }
    }

    const hintTaskActivationForm: boolean = getOptions()['diagnostics']['hintTaskActivationForm'];
    for (const action of context.qbn.iterateActions()) {
        if (hintTaskActivationForm) {
            if (action.isInvocationOf('start', 'task')) {
                const task = context.qbn.getTask(action.signature[2].value);
                if (task && task.isVariable) {
                    yield Hints.changeStartTaskToSetVar(action.getRange(0));
                }
            } else if (action.isInvocationOf('setvar')) {
                const task = context.qbn.getTask(action.signature[1].value);
                if (task && !task.isVariable) {
                    yield Hints.changeSetVarToStartTask(action.getRange(0));
                }
            }
        }

        yield* analyseSignature(context, data, action.line, action.signature, true);
    }

    for (const line of context.qbn.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'QBN');
    }
}

function symbolHasReferences(context: Quest, symbol: string): boolean {
    const baseSymbol = parser.symbols.getBaseSymbol(symbol);
    for (const action of context.qbn.iterateActions()) {
        if (action.signature.find(x => x.value === baseSymbol)) {
            return true;
        }
    }

    const regex = parser.symbols.makeSymbolRegex(symbol);
    if (first(context.qrc.iterateMessageLines(), x => regex.test(x.text))) {
        return true;
    }

    return false;
}

function taskIsUsed(context: Quest, taskName: string, task: Task, modules: Modules): boolean {
    // Started by trigger
    if (task.hasAnyCondition(modules)) {
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