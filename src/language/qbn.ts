/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';
import { TextLine } from 'vscode';
import { Language } from './static/language';
import { TaskType } from '../parsers/parser';
import { Modules } from './static/modules';
import { Symbol, QuestBlock, Task, Action } from './common';
import { wordRange } from '../diagnostics/common';

/**
 * Quest resources and operation: the quest block that holds resources definition and tasks.
 */
export class Qbn extends QuestBlock {

    /**
     * Symbols that reference the resources used by the quest.
     */
    public readonly symbols = new Map<string, Symbol | Symbol[]>();
    
    /**
     * Headless startup task which starts automatically when the quest begins.
     */
    public readonly entryPoint: Action[] = [];

    /**
     * The executable components of the quest.
     */
    public readonly tasks = new Map<string, Task | Task[]>();

    /**
     * A special kind of tasks whose execution is based on the state of another task.
     */
    public readonly persistUntilTasks: Task[] = [];

    private currentActionsBlock: Action[] = this.entryPoint;

    /**
    * Parses a line in a QBN block and build its diagnostic context.
    * @param line A line in QBN block. 
    */
    public parse(line: TextLine): void {

        // Symbol definition
        const symbol = parser.getSymbolFromLine(line);
        if (symbol) {
            const text = line.text.trim();
            const type = text.substring(0, text.indexOf(' '));
            const definition = Language.getInstance().findDefinition(type, text);

            const symbolDefinitionContext = new Symbol(type, wordRange(line, symbol), line);
            if (definition) {
                symbolDefinitionContext.parse(definition.matches);
            }

            const symbolDefinition = this.symbols.get(symbol);
            if (!symbolDefinition) {
                this.symbols.set(symbol, symbolDefinitionContext);
            } else if (!Array.isArray(symbolDefinition)) {
                this.symbols.set(symbol, [symbolDefinition, symbolDefinitionContext]);
            } else {
                symbolDefinition.push(symbolDefinitionContext);
            }

            return;
        }

        // Task definition
        const task = parser.parseTaskDefinition(line.text);
        if (task) {

            const newTaskDefinition = new Task(wordRange(line, task.symbol), task);
            if (task.type === TaskType.PersistUntil) {
                this.persistUntilTasks.push(newTaskDefinition);
            } else {
                const taskDefinition = this.tasks.get(task.symbol);
                if (!taskDefinition) {
                    this.tasks.set(task.symbol, newTaskDefinition);
                } else if (!Array.isArray(taskDefinition)) {
                    this.tasks.set(task.symbol, [taskDefinition, newTaskDefinition]);
                } else {
                    taskDefinition.push(newTaskDefinition);
                }
            }

            this.currentActionsBlock = newTaskDefinition.actions;
            return;
        }

        // Action invocation
        const actionResult = Modules.getInstance().findAction(line.text);
        if (actionResult) {
            this.currentActionsBlock.push(new Action(line, actionResult.getSignature()));
            return;
        }

        this.failedParse.push(line);
    }

    /**
     * Iterates all symbols in this QBN block.
     */
    public *iterateSymbols(): Iterable<Symbol> {
        yield* Qbn.iterateMapItems(this.symbols);
    }

    /**
     * Iterates all tasks in this QBN block, including the *persist until* tasks.
     */
    public *iterateTasks(): Iterable<Task> {
        yield* Qbn.iterateMapItems(this.tasks);
        yield* this.persistUntilTasks;
    }

    /**
     * Iterates all actions from all tasks in this QBN block, 
     * including *persist until* tasks and the entry point.
     */
    public *iterateActions(): Iterable<Action> {
        yield* this.entryPoint;
        for (const task of this.iterateTasks()) {
            yield* task.actions;
        }
    }

    /**
     * Gets a symbol from any of its variations.
     * @param symbol Any variation of a symbol.
     */
    public getSymbol(symbol: string): Symbol | undefined {
        return Qbn.getMapItem(this.symbols, parser.getBaseSymbol(symbol));
    }

    /**
     * Gets a task from its name.
     * @param task The name of a task.
     */
    public getTask(task: string): Task | undefined {
        return Qbn.getMapItem(this.tasks, task);
    }

    private static *iterateMapItems<T>(items: Map<string, T | T[]>): Iterable<T> {
        for (const item of items) {
            if (Array.isArray(item[1])) {
                yield* item[1];
            } else {
                yield item[1];
            }
        }
    }

    private static getMapItem<T>(items: Map<string, T | T[]>, key: string): T | undefined {
        const item = items.get(key);
        if (item) {
            return Array.isArray(item) ? item[0] : item;
        }
    }
}