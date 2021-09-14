/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { Diagnostic } from "vscode";
import { first, getOptions } from '../extension';
import { TaskType } from '../parser';
import { SymbolType } from '../language/static/common';
import { LanguageData } from '../language/static/languageData';
import { Modules } from '../language/static/modules';
import { ParameterTypes } from '../language/static/parameterTypes';
import { Tables } from '../language/static/tables';
import { QuestBlockKind } from '../language/common';
import { Quest } from '../language/quest';
import { Quests } from '../language/quests';
import { Errors, findParameter, Hints, Warnings, Informations } from './common';
import { SignatureLinter } from './signatureLinter';
import { QuestBlock, Symbol, Task } from '../language/resources';

export class QuestLinter {
    private readonly signatureLinter: SignatureLinter;

    public constructor(private readonly data: LanguageData, private readonly quests: Quests) {
        this.signatureLinter = new SignatureLinter(data);
    }

    public async analyse(document: vscode.TextDocument): Promise<Diagnostic[]> {
        const quest = this.quests.get(document);
        const [preamble, qrc, qbn] = await Promise.all([
            this.analysePreamble(quest),
            this.analyseQrc(quest),
            this.analyseQbn(quest)
        ]);
        return preamble.concat(qrc, qbn);
    }

    private async analysePreamble(quest: Quest): Promise<Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];

        for (const directive of quest.preamble.directives) {
            diagnostics.push(...this.signatureLinter.analyseSignature(quest, directive));

            if (!quest.document.isUntitled && !directive.node.content.range.isEmpty &&
                directive.name === 'Quest' && quest.name !== directive.parameter.value) {
                diagnostics.push(Warnings.questNameMismatch(directive.node.content.range));
            }
        }

        this.failedParse(quest.preamble, diagnostics);
        return diagnostics;
    }

    private async analyseQrc(quest: Quest): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        if (!this.blockIsFound(quest, quest.qrc, diagnostics)) {
            return diagnostics;
        }

        for (let index = 0; index < quest.qrc.messages.length; index++) {
            const message = quest.qrc.messages[index];

            // Unused
            if (!message.alias && !this.messageHasReferences(quest, this.data.tables, message.id)) {
                diagnostics.push(Warnings.unusedDeclarationMessage(message.range, String(message.id)));
            }

            // Incorrect position
            if (index > 0 && message.id < quest.qrc.messages[index - 1].id) {
                const previous = quest.qrc.messages[index - 1];
                diagnostics.push(Hints.incorrectMessagePosition(message.range, message.id, previous.id, quest.getLocation(previous.range)));
            }

            // Duplicated definition
            const collisions = quest.qrc.messages.filter(x => x.id === message.id);
            if (collisions.length > 1) {
                const allLocations = collisions.map(x => quest.getLocation(x.range));
                diagnostics.push(Errors.duplicatedMessageNumber(message.range, message.id, allLocations));
            }

            // Check or suggest alias
            if (message.alias) {
                const id = this.data.tables.staticMessagesTable.messages.get(message.alias);
                if (!id || message.id !== id) {
                    diagnostics.push(Errors.invalidStaticMessageDefinition(message.range, message.id, message.alias));
                }
            } else {
                for (const [, id] of this.data.tables.staticMessagesTable.messages) {
                    if (id === message.id) {
                        diagnostics.push(Hints.useAliasForStaticMessage(message.range, message.id));
                        break;
                    }
                }
            }

            if (message.node.symbols !== undefined) {
                for (const symbol of message.node.symbols) {
                    let symbolDefinition: Symbol | Symbol[] | undefined = quest.qbn.symbols.get(parser.symbols.getBaseSymbol(symbol.value));
                    if (symbolDefinition === undefined) {
                        diagnostics.push(Errors.undefinedSymbol(symbol.range, symbol.value));
                    } else {
                        if (Array.isArray(symbolDefinition)) {
                            symbolDefinition = symbolDefinition[0];
                        }

                        diagnostics.push(!this.data.language.isSymbolVariationDefined(symbol.value, symbolDefinition.type) ?
                            Warnings.incorrectSymbolVariation(symbol.range, symbol.value, symbolDefinition.type) :
                            Hints.changeSymbolVariation(symbol.range));
                    }
                }
            }

            if (message.node.macros !== undefined) {
                for (const macro of message.node.macros) {
                    if (!this.data.language.findSymbol(macro.value)) {
                        diagnostics.push(Errors.undefinedContextMacro(macro.range, macro.value));
                    }
                }
            }
        }

        this.failedParse(quest.qrc, diagnostics);
        return diagnostics;
    }

    private async analyseQbn(quest: Quest): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];
        if (!this.blockIsFound(quest, quest.qbn, diagnostics)) {
            return diagnostics;
        }

        for (const [name, symbols] of quest.qbn.symbols) {

            const firstSymbol = Array.isArray(symbols) ? symbols[0] : symbols;
            if (!firstSymbol) {
                continue;
            }

            // Invalid signature or parameters
            if (!firstSymbol.signature) {
                diagnostics.push(Errors.invalidDefinition(firstSymbol.blockRange, name, firstSymbol.type));
            }

            // Duplicated definition
            if (Array.isArray(symbols)) {
                const allLocations = symbols.map(x => quest.getLocation(x.range));
                for (const symbolDefinition of symbols) {
                    diagnostics.push(Errors.duplicatedDefinition(symbolDefinition.range, name, allLocations));
                }

                for (const symbol of symbols) {
                    if (symbol.signature) {
                        diagnostics.push(...this.signatureLinter.analyseSignature(quest, symbol));
                    }
                }
            } else {
                if (symbols.signature) {
                    diagnostics.push(...this.signatureLinter.analyseSignature(quest, symbols));
                }
            }

            // Unused
            if (!this.symbolHasReferences(quest, name)) {
                diagnostics.push(Warnings.unusedDeclarationSymbol(firstSymbol.range, name));
            }

            // Clock
            if (firstSymbol.type === SymbolType.Clock) {
                if (!first(quest.qbn.iterateActions(), x => x.node.value.startsWith('start timer ' + name) === true)) {
                    diagnostics.push(Warnings.unstartedClock(firstSymbol.range, name));
                }
                if (!quest.qbn.tasks.get(name)) {
                    diagnostics.push(Warnings.unlinkedClock(firstSymbol.range, name));
                }
            }

            // Naming convention violation
            if (!parser.symbols.symbolFollowsNamingConventions(name)) {
                diagnostics.push(Hints.symbolNamingConventionViolation(firstSymbol.range));
            }
        }

        for (const [name, tasks] of quest.qbn.tasks) {

            const firstTask = Array.isArray(tasks) ? tasks[0] : tasks;
            if (!firstTask) {
                continue;
            }

            // Duplicated definition
            if (Array.isArray(tasks)) {
                const allLocations = tasks.map(x => quest.getLocation(x.range));
                for (const definition of tasks) {
                    diagnostics.push(Errors.duplicatedDefinition(definition.range, name, allLocations));
                }
            }

            // Unused      
            if (!this.taskIsUsed(quest, name, firstTask, this.data.modules)) {
                const definition = firstTask.node;
                const name = definition.type === TaskType.GlobalVarLink ? definition.symbol.value + ' from ' + definition.globalVarName : definition.symbol.value;
                diagnostics.push(Warnings.unusedDeclarationTask(firstTask.range, name));
            }

            // Naming convention violation
            if (!parser.symbols.symbolFollowsNamingConventions(name)) {
                diagnostics.push(Hints.symbolNamingConventionViolation(firstTask.range));
            }

            // Convert to variable
            if (firstTask.actions.length === 0 && !firstTask.isVariable) {
                diagnostics.push(Hints.convertTaskToVariable(firstTask.range));
            }
        }

        for (const task of quest.qbn.persistUntilTasks) {

            // until performed is associated to undefined task
            if (!quest.qbn.tasks.has(task.node.symbol.value)) {
                diagnostics.push(Errors.undefinedUntilPerformed(task.range, task.node.symbol.value));
            }
        }

        const hintTaskActivationForm: boolean = getOptions()['diagnostics']['hintTaskActivationForm'];
        for (const action of quest.qbn.iterateActions()) {
            if (action.info.isObsolete()) {
                diagnostics.push(Informations.obsoleteAction(action.getRange(), action.getFullName()));
            }

            if (hintTaskActivationForm) {
                if (action.isInvocationOf('start', 'task')) {
                    const task = quest.qbn.getTask(action.signature[2].value);
                    if (task && task.isVariable) {
                        diagnostics.push(Hints.changeStartTaskToSetVar(action.range));
                    }
                } else if (action.isInvocationOf('setvar')) {
                    const task = quest.qbn.getTask(action.signature[1].value);
                    if (task && !task.isVariable) {
                        diagnostics.push(Hints.changeSetVarToStartTask(action.range));
                    }
                }
            }

            const index = action.signature.findIndex(x => x.type === ParameterTypes.questName || x.type === ParameterTypes.questID);
            if (index !== -1) {
                const name = action.signature[index].value;
                if (!await this.quests.find(name)) {
                    diagnostics.push(Errors.undefinedQuest(action.getRange(index), name));
                }
            }

            diagnostics.push(...this.signatureLinter.analyseSignature(quest, action));
        }

        this.failedParse(quest.qbn, diagnostics);
        return diagnostics;
    }

    private blockIsFound(quest: Quest, block: QuestBlock, diagnostics: Diagnostic[]): boolean {
        if (!block.found) {
            const questName = quest.preamble.questName;
            if (questName) {
                diagnostics.push(Errors.blockMissing(questName.node.content.range, QuestBlockKind[block.kind]));
            }

            return false;
        }

        return true;
    }

    private failedParse(block: QuestBlock, diagnostics: Diagnostic[]): void {
        for (const unknownToken of block.failedParse) {
            diagnostics.push(Errors.undefinedExpression(unknownToken.range, QuestBlockKind[block.kind]));
        }
    }

    private messageHasReferences(context: Quest, tables: Tables, messageID: number): boolean {
        // Numeric ID
        if (findParameter(context, parameter => (parameter.type === ParameterTypes.messageID || parameter.type === ParameterTypes.message) && parameter.value === String(messageID))) {
            return true;
        }

        // Text Alias
        for (const message of tables.staticMessagesTable.messages) {
            if (message[1] === messageID) {
                if (findParameter(context, parameter => (parameter.type === ParameterTypes.messageName || parameter.type === ParameterTypes.message) && parameter.value === message[0])) {
                    return true;
                }
            }
        }

        return false;
    }

    private symbolHasReferences(context: Quest, symbol: string): boolean {
        const baseSymbol = parser.symbols.getBaseSymbol(symbol);
        for (const action of context.qbn.iterateActions()) {
            if (action.signature.find(x => x.value === baseSymbol)) {
                return true;
            }
        }

        if (context.qrc.messages.find(x => x.node.symbols !== undefined &&
            x.node.symbols.find(x => parser.symbols.getBaseSymbol(x.value) === baseSymbol)) !== undefined) {
            return true;
        }

        return false;
    }

    private taskIsUsed(context: Quest, taskName: string, task: Task, modules: Modules): boolean {
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
}