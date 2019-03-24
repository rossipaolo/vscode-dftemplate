/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';
import { ReferenceProvider, TextDocument, Position, Location, CancellationToken, Range } from 'vscode';
import { Quest } from '../language/quest';
import { Symbol, Message, Task, Action } from '../language/common';
import { wordRange } from '../diagnostics/common';
import { ParameterTypes } from '../language/static/parameterTypes';
import { questIndexToName } from '../parsers/parser';
import { first } from '../extension';

export class TemplateReferenceProvider implements ReferenceProvider {

    public provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean }, token: CancellationToken): Thenable<Location[]> {
        return new Promise((resolve, reject) => {
            const line = document.lineAt(position.line);
            const word = parser.getWord(document, position);
            if (word) {

                const quest = Quest.get(document);

                // Message
                const message = quest.qrc.getMessage(word);
                if (message) {
                    return resolve(TemplateReferenceProvider.messageReferences(quest, message, options.includeDeclaration));
                }

                // Symbol
                const symbol = quest.qbn.getSymbol(word);
                if (symbol) {
                    return resolve(TemplateReferenceProvider.symbolReferences(quest, symbol, options.includeDeclaration));
                }

                // Task
                const task = quest.qbn.getTask(word);
                if (task) {
                    return resolve(TemplateReferenceProvider.taskReferences(quest, task, options.includeDeclaration));
                }

                // Action
                const action = first(quest.qbn.iterateActions(), x => x.line.lineNumber === line.lineNumber);
                if (action && action.getName() === word) {
                    return resolve(TemplateReferenceProvider.workspaceActionReferences(action, token));
                }

                // Symbol macro
                if (word.startsWith('%')) {
                    return resolve(TemplateReferenceProvider.workspaceSymbolMacroReferences(word, token));
                }

                // Quest
                if (parser.isQuestReference(line.text, word)) {
                    return TemplateReferenceProvider.questReferences(word, options.includeDeclaration, token).then(
                        locations => resolve(locations));
                }

                // Global variables
                const globalVar = first(quest.qbn.iterateTasks(), x => x.definition.globalVarName === word);
                if (globalVar) {
                    return TemplateReferenceProvider.globalVarReferences(globalVar, token).then(
                        locations => resolve(locations));
                }
            }

            return reject();
        });
    }

    public static messageReferences(quest: Quest, message: Message, includeDeclaration: boolean = true): Location[] {
        const locations: Location[] = [];

        // Definition
        if (includeDeclaration) {
            locations.push(quest.getLocation(message.range));
        }

        // Actions
        for (const action of quest.qbn.iterateActions()) {
            for (const parameter of action.signature) {
                if (parameter.type === ParameterTypes.message || parameter.type === ParameterTypes.messageID) {
                    if (Number(parameter.value) === message.id)  {
                        locations.push(quest.getLocation(wordRange(action.line, parameter.value)));
                    }
                }

                if (parameter.type === ParameterTypes.message || parameter.type === ParameterTypes.messageName) {
                    if (parameter.value === message.alias)  {
                        locations.push(quest.getLocation(wordRange(action.line, parameter.value)));
                    }
                }
            }
        }

        return locations;
    }

    public static symbolReferences(quest: Quest, symbol: Symbol, includeDeclaration: boolean = true): Location[] {
        const locations: Location[] = [];

        // Messages
        const regex = parser.makeSymbolRegex(symbol.name);
        for (const line of quest.qrc.iterateMessageLines()) {
            let match: RegExpExecArray | null;
            while (match = regex.exec(line.text)) {
                locations.push(quest.getLocation(new Range(line.lineNumber, match.index, line.lineNumber, match.index + match[0].length)));
            }
        }

        // Definition
        if (includeDeclaration) {
            locations.push(quest.getLocation(symbol.range));
        }

        // Actions
        const baseSymbol = parser.getBaseSymbol(symbol.name);
        for (const action of quest.qbn.iterateActions()) {
            if (action.signature.find(x => x.value === baseSymbol)) {
                locations.push(quest.getLocation(wordRange(action.line, baseSymbol)));
            }
        }

        // Clock task
        const task = quest.qbn.getTask(symbol.name);
        if (task) {
            locations.push(quest.getLocation(task.range));
        }

        return locations;
    }

    public static taskReferences(quest: Quest, task: Task, includeDeclaration: boolean = true): Location[] {
        const locations: Location[] = [];

        // Definition
        if (includeDeclaration) {
            locations.push(quest.getLocation(task.range));
        }

        // UntilPerformed
        for (const untilPerformed of quest.qbn.persistUntilTasks.filter(x => x.definition.symbol === task.definition.symbol)) {
            locations.push(quest.getLocation(untilPerformed.range));
        }

        // Actions
        for (const action of quest.qbn.iterateActions()) {
            for (const parameter of action.signature) {
                if (parameter.type === ParameterTypes.task && parameter.value === task.definition.symbol) {
                    locations.push(quest.getLocation(wordRange(action.line, parameter.value)));
                }
            }
        }

        return locations;
    }

    public static actionReferences(quest: Quest, action: Action): Location[] {
        const locations: Location[] = [];

        const name = action.getName();
        for (const other of quest.qbn.iterateActions()) {
            if (action.compareSignature(other)) {
                locations.push(quest.getLocation(wordRange(other.line, name)));
            }
        }
        
        return locations;
    }

    public static async workspaceActionReferences(action: Action, token?: CancellationToken): Promise<Location[]> {
        const locations: Location[] = [];

        for (const quest of await Quest.getAll(token)) {
            locations.push(...TemplateReferenceProvider.actionReferences(quest, action));
        }

        return locations;
    }

    public static symbolMacroReferences(quest: Quest, symbol: string): Location[] {
        const locations: Location[] = [];

        for (const macro of quest.qrc.macros) {
            if (macro.symbol === symbol) {
                locations.push(quest.getLocation(macro.range));
            }
        }

        return locations;
    }

    public static async workspaceSymbolMacroReferences(symbol: string, token?: CancellationToken): Promise<Location[]> {
        const locations: Location[] = [];

        for (const quest of await Quest.getAll(token)) {
            locations.push(...TemplateReferenceProvider.symbolMacroReferences(quest, symbol));
        }

        return locations;
    }

    public static async questReferences(questNameOrId: string, includeDeclaration: boolean = true, token?: CancellationToken): Promise<Location[]> {
        const locations: Location[] = [];
        
        questNameOrId = !isNaN(Number(questNameOrId)) ? questIndexToName(questNameOrId) : questNameOrId;

        const quests = await Quest.getAll(token);
        for (const quest of quests) { 
            if (quest.getName() === questNameOrId) {

                // Definition
                if (includeDeclaration) {
                    locations.push(quest.getNameLocation());
                }
            } else {

                // Actions
                for (const action of quest.qbn.iterateActions()) {
                    for (const parameter of action.signature) {
                        if (parameter.type === ParameterTypes.questName) {
                            if (parameter.value === questNameOrId) {
                                locations.push(quest.getLocation(wordRange(action.line, parameter.value)));
                            }
                        } else if (parameter.type === ParameterTypes.questID) {
                            if (questIndexToName(parameter.value) === questNameOrId) {
                                locations.push(quest.getLocation(wordRange(action.line, parameter.value)));
                            }
                        }
                    }
                }
            }
        }

        return locations;
    }

    public static async globalVarReferences(task: Task, token?: CancellationToken): Promise<Location[]> {
        const locations: Location[] = [];

        const quests = await Quest.getAll(token);
        for (const quest of quests) {
            for (const other of quest.qbn.iterateTasks()) {
                const globalVarName = other.definition.globalVarName;
                if (globalVarName && task.definition.globalVarName === globalVarName) {
                    locations.push(quest.getLocation(wordRange(quest.document.lineAt(other.range.start.line), globalVarName)));
                }
            }
        }

        return locations;
    }
}