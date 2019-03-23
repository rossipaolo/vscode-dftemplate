/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { Range, TextLine } from "vscode";
import { TaskDefinition, TaskType } from "../parsers/parser";
import { ParameterMatch, QuestResourceCategory } from "./static/common";
import { Modules } from "./static/modules";
import { wordRange } from "../diagnostics/common";

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

    public signature: Parameter[] | null = null;

    public get name() {
        return this.line.text.trim().split(' ')[1];
    }

    public get blockRange() {
        return this.line.range;
    }

    public constructor(
        public type: string,
        public range: Range,
        public line: TextLine) {
    }

    /**
     * Parses the symbol definition and retrieve its parameters.
     * @param signature Regex that matches parameter.
     */
    public parse(signature: ParameterMatch[]): void {
        this.signature = signature ? signature.reduce<Parameter[]>((parameters, word) => {
            const match = this.line.text.match(word.regex);
            if (match) {
                parameters.push({ type: word.signature, value: match[1] });
            }

            return parameters;
        }, []) : [];
    }
}

/**
 * A group of actions that can be executed, with a flag for its triggered state.
 * When the action list is empty, the task is used as a set/unset variable.
 */
export class Task implements QuestResource {

    public readonly actions: Action[] = [];

    public get isVariable(): boolean {
        return this.definition.type === TaskType.Variable
            || this.definition.type === TaskType.GlobalVarLink;
    }

    public get blockRange(): Range {
        return this.actions.length > 0 ?
            this.range.union(this.actions[this.actions.length - 1].line.range) :
            this.range;
    }

    public constructor(
        public range: Range,
        public definition: TaskDefinition) {
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

    public get blockRange(): Range {
        const lineRange = this.range.with(this.range.start.with(undefined, 0));
        return this.textBlock.length > 0 ?
            lineRange.union(this.textBlock[this.textBlock.length - 1].range) :
            lineRange;
    }

    public constructor(
        public id: number,
        public range: Range,
        public alias?: string) {
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
        if (this.start && this.end) {
            return new Range(this.start, 0, this.end, 0);
        }
    }
}