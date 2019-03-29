/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { Range, TextLine } from "vscode";
import { tasks, wordRange } from "../parser";
import { QuestResourceCategory, SymbolType } from "./static/common";
import { Modules } from "./static/modules";
import { Language } from "./static/language";

/**
 * A resource usable in a quest.
 */
export interface QuestResource {

    /**
     * The range of the symbol declaration.
     */
    range: Range;

    /**
     * The range of the entire definition.
     */
    blockRange: Range;
}

/**
 * A parameter in a symbol or action signature.
 */
export interface Parameter {
    type: string;
    value: string;
}

/**
 * A symbol used by resources and tasks, and for text replacement inside messages.
 */
export class Symbol implements QuestResource {

    /**
     * The string that allows to reference this symbol, declared with the definition.
     * It often includes a prefix and suffix: `_symbol_`.
     */
    public get name(): string {
        return this.line.text.trim().split(' ')[1];
    }

    /**
     * The range of the line where the symbol is defined.
     */
    public get blockRange() {
        return this.line.range;
    }

    private constructor(

        /**
         * What kind of resource is linked to this symbol.
         */
        public readonly type: SymbolType,

        /**
         * The range of the symbol.
         */
        public readonly range: Range,

        /**
         * The line where the symbol is defined.
         */
        public readonly line: TextLine,

        /**
         * Parameters provided with the symbol definition.
         */
        public readonly signature: Parameter[] | undefined) {
    }

    /**
     * Attempts to parse a symbol definition.
     * @param line A text line with a symbol definition.
     * @returns A `Symbol` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine): Symbol | undefined {
        const name = parser.symbols.parseSymbol(line.text);
        if (name) {
            const text = line.text.trim();
            const type = text.substring(0, text.indexOf(' '));
            const signature = Symbol.parseSignature(type, text);
            return new Symbol(type as SymbolType, wordRange(line, name), line, signature);
        }
    }

    /**
     * Matches parameters for the given symbol definition.
     * @param type The type of the symbol.
     * @param text The entire symbol definition line.
     * @returns An array of parameters, which can be empty, if parse operation was successful,
     * `undefined` otherwise.
     */
    private static parseSignature(type: string, text: string): Parameter[] | undefined {
        const definition = Language.getInstance().findDefinition(type, text);
        if (definition) {
            if (definition.matches && definition.matches.length > 0) {
                return definition.matches.reduce<Parameter[]>((parameters, word) => {
                    const match = text.match(word.regex);
                    if (match) {
                        parameters.push({ type: word.signature, value: match[1] });
                    }

                    return parameters;
                }, []);
            }

            return [];
        }
    }
}

/**
 * A group of actions that can be executed, with a flag for its triggered state.
 * When the action list is empty, the task is used as a set/unset variable.
 */
export class Task implements QuestResource {

    /**
     * The actions block owned by this task.
     */
    public readonly actions: Action[] = [];

    /**
     * True if this task is declared as a variable.
     */
    public get isVariable(): boolean {
        return this.definition.type === tasks.TaskType.Variable
            || this.definition.type === tasks.TaskType.GlobalVarLink;
    }

    /**
     * The range of the task with its actions block.
     */
    public get blockRange(): Range {
        return this.actions.length === 0 ? this.line.range :
            this.range.union(this.actions[this.actions.length - 1].line.range);
    }

    private constructor(

        /**
         * The line where this task is declared.
         */
        public readonly line: TextLine,

        /**
         * The range of the symbol of this task.
         */
        public readonly range: Range,

        /**
         * Informations provided with the task definition, such as symbol and type.
         */
        public readonly definition: tasks.TaskDefinition) {
    }

    /**
     * Does this task have at least one condition?
     */
    public hasAnyCondition(): boolean {
        return !!this.actions.find(action => {
            const actionInfo = Modules.getInstance().findAction(action.line.text);
            return !!(actionInfo && actionInfo.category === QuestResourceCategory.Condition);
        });
    }

    /**
     * Attempts to parse a task definition.
     * @param line A text line with a task definition.
     * @returns A `Task` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine): Task | undefined {
        const task = parser.tasks.parseTask(line.text);
        if (task) {
            return new Task(line, wordRange(line, task.symbol), task);
        }
    }
}

/**
 * An action that belongs to a task and perform a specific function when task is active and conditions are met.
 */
export class Action {

    public line: TextLine;
    public signature: Parameter[];

    public constructor(line: TextLine, signature: string) {

        function doParams(signatureItems: string[], lineItems: string[]): string[] {
            if (signatureItems[signatureItems.length - 1].indexOf('${...') !== -1) {
                const last = signatureItems[signatureItems.length - 1].replace('${...', '${');
                signatureItems[signatureItems.length - 1] = last;
                if (lineItems.length > signatureItems.length) {
                    signatureItems = signatureItems.concat(Array(lineItems.length - signatureItems.length).fill(last));
                }
            }

            return signatureItems;
        }

        const values = (this.line = line).text.trim().split(' ');
        const types = doParams(signature.replace(/\${\d:/g, '${').split(' '), values);

        this.signature = values.map((value, index) => {
            return { type: types[index], value: value };
        });
    }

    /**
     * Gets the range of this action or one of its parameters.
     * @param index The index of a parameter.
     */
    public getRange(index?: number): Range {
        if (index && this.signature.length > index) {
            return wordRange(this.line, this.signature[index].value);
        }

        return this.line.range;
    }

    /**
     * The first word that is not a parameter.
     */
    public getName(): string {
        const word = this.signature.find(x => !x.type.startsWith('$'));
        return word ? word.value : '';
    }

    /**
     * Is `other` an invocation of the same action as this one?
     * @param other Another action.
     */
    public compareSignature(other: Action) {
        if (this.signature[0].type === 'when' && other.signature[0].type === 'when') {
            return true;
        }

        return this.signature.length === other.signature.length &&
            !this.signature.find((parameter, index) => parameter.type !== other.signature[index].type);
    }
}

/**
 * A macro whose replacement text is based on context.
 */
export interface ContextMacro {

    /**
     * A short name prefixed by a `%` character.
     */
    symbol: string;

    /**
     * The range of the symbol inside a message block.
     */
    range: Range;
}

/**
 * A text block with a serial number. Can be used for popups, journal, letters, and rumours.
 */
export class Message implements QuestResource {

    /**
     * The block of text associated to this message.
     */
    public readonly textBlock: TextLine[] = [];

    /**
     * The range of the message including its text block.
     */
    public get blockRange(): Range {
        const lineRange = this.range.with(this.range.start.with(undefined, 0));
        return this.textBlock.length > 0 ?
            lineRange.union(this.textBlock[this.textBlock.length - 1].range) :
            lineRange;
    }

    private constructor(

        /**
         * The numeric id associated to this message.
         */
        public readonly id: number,

        /**
         * The range of the message id.
         */
        public readonly range: Range,

        /**
         * A meaningful string that can be used to reference the message.
         */
        public readonly alias?: string) {
    }

    /**
     * Attempts to parse a message definition.
     * @param line A text line with a message definition.
     * @returns A `Message` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine): Message | undefined {
        const id = parser.messages.parseMessage(line.text);
        if (id) {
            return new Message(id, wordRange(line, String(id)));
        }

        const data = parser.messages.parseStaticMessage(line.text);
        if (data) {
            return new Message(data.id, wordRange(line, String(data.id)), data.name);
        }
    }
}

/**
 * A block of a quest.
 */
export abstract class QuestBlock {
    public start: number | undefined;
    public end: number | undefined;
    public readonly failedParse: TextLine[] = [];

    public get found(): boolean {
        return this.start !== undefined;
    }

    public get range(): Range | undefined {
        if (this.start !== undefined && this.end !== undefined) {
            return new Range(this.start, 0, this.end, 0);
        }
    }
}