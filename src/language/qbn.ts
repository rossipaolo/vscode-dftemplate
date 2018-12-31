/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';
import { TextLine } from 'vscode';
import { Language } from './language';
import { TaskType } from '../parsers/parser';
import { Modules } from './modules';
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
     * The executable components of the quest.
     */
    public readonly tasks = new Map<string, Task | Task[]>();

    /**
     * A special kind of tasks whose execution is based on the state of another task.
     */
    public readonly persistUntilTasks: Task[] = [];
    
    /**
     * Merged actions from all tasks.
     */
    public readonly actions = new Map<string, Action>();

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

            const newTaskDefinition = {
                range: wordRange(line, task.symbol),
                definition: task
            };

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

            return;
        }

        // Action invocation
        const actionResult = Modules.getInstance().findAction(line.text);
        if (actionResult) {
            this.actions.set(line.text.trim(), new Action(line, actionResult.action.overloads[actionResult.overload]));
            return;
        }

        this.failedParse.push(line);
    }
}