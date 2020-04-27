/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextDocument, TextLine, Range } from "vscode";
import { tasks, wordRange } from "../parser";
import { QuestResourceCategory, SymbolType, ActionInfo } from "./static/common";
import { Modules } from "./static/modules";
import { Language } from "./static/language";
import { LanguageData } from './static/languageData';
import { EOL } from 'os';
import { StaticData } from './static/staticData';
import { Tables } from './static/tables';

/**
 * A quest resource with a tag that defines its category.
 */
export type CategorizedQuestResource = {
    readonly kind: 'message'; readonly value: Message;
} | {
    readonly kind: 'symbol'; readonly value: Symbol; readonly variation?: string;
} | {
    readonly kind: 'task'; readonly value: Task;
} | {
    readonly kind: 'action'; readonly value: Action;
} | {
    readonly kind: 'quest' | 'directive' | 'type' | 'macro' | 'globalVar';
    readonly value: string;
};

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

    /**
     * Finalises the documentation for this resources.
     */
    makeDocumentation?: (language: Language, summary?: string) => string | undefined;
}

/**
 * A parameter in a symbol or action signature.
 */
export interface Parameter {
    type: string;
    value: string;
}

/**
 * A directive inside the quest preamble.
 */
export class Directive implements QuestResource {

    public get blockRange(): Range {
        return this.line.range;
    }

    /**
     * The range of the directive value.
     */
    public get valueRange(): Range {
        return wordRange(this.line, this.parameter.value);
    }

    private constructor(

        /**
         * The name of this directive, for example `Quest` in `Quest: name`.
         */
        public readonly name: string,

        /**
         * The single parameter of the directive, for example `name` in `Quest: name`.
         */
        public readonly parameter: Parameter,

        /**
         * The range of the directive name.
         */
        public readonly range: Range,

        /**
         * The line where the directive is defined.
         */
        public readonly line: TextLine
    ) {
    }

    /**
     * Attempts to parse a directive inside the preamble.
     * @param line A text line with a directive.
     * @returns A `Directive` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, language: Language): Directive | undefined {
        const split = line.text.trim().split(':', 2);
        if (split.length === 2) {
            const result = language.findDirective(split[0]);
            if (result) {
                const match = result.signature.match(/[a-zA-Z]+: \${1:([a-zA-Z]+)}/);
                if (match) {
                    const parameter = {
                        type: `\${${match[1]}}`,
                        value: split[1].trim()
                    };
                    return new Directive(split[0].trim(), parameter, wordRange(line, split[0]), line);
                }
            }
        }
    }
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

    public getParameterRange(parameter: Parameter): Range | undefined {
        const index = this.line.text.search(new RegExp(`\\b${parameter.value}\\b`));
        if (index !== -1) {
            return new Range(this.line.range.start.line, index, this.line.range.start.line, index + parameter.value.length);
        }
    }

    /**
     * Attempts to parse a symbol definition.
     * @param line A text line with a symbol definition.
     * @returns A `Symbol` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, language: Language): Symbol | undefined {
        const name = parser.symbols.parseSymbol(line.text);
        if (name) {
            const text = line.text.trim();
            const type = text.substring(0, text.indexOf(' '));
            const signature = Symbol.parseSignature(type, text, language);
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
    private static parseSignature(type: string, text: string, language: Language): Parameter[] | undefined {
        const definition = language.findDefinition(type, text);
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
        * The string that allows to reference this task, declared with the definition.
        * It often includes a prefix and suffix: `_symbol_`.
        */
        public readonly name: string,

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
    public hasAnyCondition(modules: Modules): boolean {
        return !!this.actions.find(action => {
            const actionInfo = modules.findAction(action.line.text);
            return !!(actionInfo && actionInfo.category === QuestResourceCategory.Condition);
        });
    }

    /**
     * Checks if at least one action is fully within the given range
     * and there are no actions which are only partially inside.
     * @example 
     * 'clicked item _item_'  // true
     * 'cked item _item_'     // false
     */
    public isValidSubRange(range: Range): boolean {
        const first = this.actions.find(x => x.line.lineNumber === range.start.line);
        const last = this.actions.find(x => x.line.lineNumber === range.end.line);

        return first !== undefined && range.start.character <= first.line.firstNonWhitespaceCharacterIndex &&
            last !== undefined && /^\s*$/.test(last.line.text.substring(range.end.character));
    }

    /**
     * Attempts to parse a task definition.
     * @param line A text line with a task definition.
     * @param tables Language tables used for parsing.
     * @returns A `Task` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, tables: Tables): Task | undefined {
        const task = parser.tasks.parseTask(line.text, tables.globalVarsTable.globalVars);
        if (task) {
            return new Task(task.symbol, line, wordRange(line, task.symbol), task);
        }
    }
}

/**
 * An action that belongs to a task and perform a specific function when task is active and conditions are met.
 */
export class Action implements QuestResource {
    public line: TextLine;
    public signature: Parameter[];
    public readonly info: ActionInfo;

    /**
     * The range of the first word that is not a parameter.
     */
    public get range(): Range {
        return this.getRange(Math.max(this.signature.findIndex(x => !x.type.startsWith('$')), 0));
    }

    /**
     * The range of the entire action.
     */
    public get blockRange(): Range {
        return this.getRange();
    }

    private constructor(line: TextLine, info: ActionInfo) {

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
        const types = doParams(info.getSignature().replace(/\${\d:/g, '${').split(' '), values);

        this.signature = values.map((value, index) => {
            return { type: types[index], value: value };
        });

        this.info = info;
    }

    /**
     * Gets the range of this action or one of its parameters.
     * @param index The index of a parameter.
     */
    public getRange(index?: number): Range {
        if (index !== undefined && this.signature.length > index) {
            const wordPosition = parser.findWordPosition(this.line.text, index);
            return new Range(this.line.lineNumber, wordPosition, this.line.lineNumber, wordPosition + this.signature[index].value.length);
        }

        return parser.trimRange(this.line);
    }

    /**
     * The first word that is not a parameter.
     */
    public getName(): string {
        const word = this.signature.find(x => !x.type.startsWith('$'));
        return word ? word.value : '';
    }

    /**
     * The entire signature as a readable string.
     */
    public getFullName(): string {
        return StaticData.prettySignature(this.info.getSignature());
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

    /**
     * Compares the parameter types of this action with the given words.
     * @param args An array of words.
     */
    public isInvocationOf(...args: string[]) {
        return args.length <= this.signature.length &&
            args.find((arg, index) => arg !== this.signature[index].type) === undefined;
    }

    /**
     * Attempts to parse an action inside a task.
     * @param line A text line with an action.
     * @param modules Imported language data.
     * @returns An `Action` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, modules: Modules): Action | undefined {
        const info = modules.findAction(line.text);
        if (info) {
            return new Action(line, info);
        }
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
        public readonly alias?: string,
    
        /**
         * The range of the message alias.
         */
        public readonly aliasRange?: Range) {
    }

    /**
     * Adds the general description to the summary if this is a static message. 
     * @param summary The formatted comment block for this message.
     */
    public makeDocumentation(language: Language, summary?: string): string | undefined {

        if (this.alias) {
            const details = language.findMessage(this.alias);
            if (details) {
                summary = summary ? details.summary + EOL.repeat(2) + summary : details.summary;
            }
        }

        return summary;
    }

    /**
     * Makes a compact but readable preview of the message, to be shown inside tooltips.
     * @param textBlockSeparationLine Adds an empty line between definition and text block for better readability.
     * @param maxLenght Maximum number of characters taken from the text block.
     */
    public makePreview(textBlockSeparationLine: boolean, maxLenght: number = 150): string {
        const previewLines: string[] = [];

        previewLines.push(this.alias !== undefined ? `${this.alias}: [${this.id}]` : `Message: ${this.id}`);

        let lenght = 0;
        for (const line of this.textBlock) {
            let text = line.text.replace('<ce>', '').trim();
            
            if (text === '<--->') {
                break;
            }

            if (lenght === 0) {
                text = (textBlockSeparationLine ? '\n\n' : '\n') + text;
            }

            if ((lenght += text.length) >= maxLenght) {
                previewLines.push(text.substr(0, maxLenght - lenght - text.length) + ' [...]');
                break;
            }

            previewLines.push(text);
        }

        return previewLines.join(' ');
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
            return new Message(data.id, wordRange(line, String(data.id)), data.name, wordRange(line, data.name));
        }
    }
}

export enum QuestBlockKind {
    Preamble,
    QRC,
    QBN
}

export interface QuestParseContext {
    data: LanguageData;
    document: TextDocument;
    block: QuestBlock;
    blockStart: number;
    currentMessageBlock?: parser.messages.MessageBlock;
    currentActionsBlock?: Action[];
}

/**
 * A block of a quest.
 */
export abstract class QuestBlock {

    private _range: Range | undefined;

    /**
     * Which block is this?
     */
    public abstract get kind(): QuestBlockKind;

    /**
     * Lines which can't be parsed as any known quest object.
     */
    public readonly failedParse: TextLine[] = [];

    /**
     * True if this block has been found and parsed. Any line for which parse 
     * operation was unsuccessful can be retrieved from `failedParse`.
     */
    public get found(): boolean {
        return this._range !== undefined;
    }

    /**
     * The range of the entire block.
     */
    public get range(): Range | undefined {
        return this._range;
    }

    /**
     * Parses a line of a document.
     * @param line The line to parse.
     * @param context Data for the current parse operation.
     */
    public abstract parse(line: TextLine, context: QuestParseContext): void;

    /**
     * Sets the range of this block in the parsed document.
     * @param document The document where this block is found.
     * @param start The first line number of this block.
     * @param end The last line number of this block.
     */
    public setRange(document: TextDocument, start: number, end: number) {
        if (this._range !== undefined) {
            throw new Error('Quest block range is already set!');
        }

        this._range = document.validateRange(new Range(start, 0, end, Infinity));
    }
}