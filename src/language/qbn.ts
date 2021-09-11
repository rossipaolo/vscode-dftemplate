/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextLine, Range } from 'vscode';
import { first } from '../extension';
import { QuestBlockKind, Parameter, QuestResourceWithParameters } from './common';
import { TaskType } from '../parser';
import { Action, QuestBlock, QuestParseContext, Symbol, Task } from './resources';

/**
 * Quest resources and operation: the quest block that holds resources definition and tasks.
 */
export class Qbn extends QuestBlock {

    public readonly kind = QuestBlockKind.QBN;

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

    /**
    * Parses a line in a QBN block and build its diagnostic context.
    * @param line A line in QBN block. 
    */
    public parse(line: TextLine, context: QuestParseContext): void {
        if (context.currentActionsBlock !== undefined) {
            const action: Action | undefined = Action.parse(line, context.nodeParser, context.data.modules);
            if (action !== undefined) {
                context.currentActionsBlock.push(action);
                return;
            }
        } else {
            const symbol: Symbol | undefined = Symbol.parse(line, context.nodeParser, context.data.language);
            if (symbol !== undefined) {
                Qbn.pushMapItem(this.symbols, symbol.name, symbol);
                return;
            }

            const task: Task | undefined = Task.parse(line, context.nodeParser);
            if (task !== undefined) {
                if (task.node.type === TaskType.PersistUntil) {
                    this.persistUntilTasks.push(task);
                } else {
                    Qbn.pushMapItem(this.tasks, task.node.symbol.value, task);
                }

                if (task.node.type === TaskType.Standard || task.node.type === TaskType.PersistUntil) {
                    context.currentActionsBlock = task.actions;
                }       
                return;
            }

            const action: Action | undefined = Action.parse(line, context.nodeParser, context.data.modules);
            if (action !== undefined) {
                context.currentActionsBlock = this.entryPoint;
                context.currentActionsBlock.push(action);
                return;
            }
        }

        this.failedParse.push(context.nodeParser.parseToken(line));
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
        return Qbn.getMapItem(this.symbols, parser.symbols.getBaseSymbol(symbol));
    }

    /**
     * Gets a task.
     * @param task The name of a task or its range.
     */
    public getTask(task: string | Range): Task | undefined {
        return task instanceof Range ?
            first(this.iterateTasks(), x => x.range.isEqual(task) || x.blockRange.isEqual(task)) :
            Qbn.getMapItem(this.tasks, task);
    }

    /**
     * Gets an action.
     * @param range A range in this QBN block.
     */
    public getAction(range: Range): Action | undefined {
        return first(this.iterateActions(), x => x.range.isEqual(range));
    }

    /**
     * Gets a parameter of a symbol definition or an action.
     * @param range The range of the parameter in the document.
     */
    public getParameter(range: Range): Parameter | undefined {
        const resource: QuestResourceWithParameters | undefined = first(this.iterateSymbols(), x => x.blockRange.contains(range)) ??
            first(this.iterateActions(), x => x.getRange().contains(range));
        return resource?.fromRange(range);
    }

    private static pushMapItem<T>(items: Map<string, T | T[]>, key: string, item: T) {
        const entry = items.get(key);
        if (!entry) {
            items.set(key, item);
        } else if (!Array.isArray(entry)) {
            items.set(key, [entry, item]);
        } else {
            entry.push(item);
        }
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