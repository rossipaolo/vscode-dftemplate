/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { EOL } from "os";
import { TextDocument, Range, TextLine } from "vscode";
import { NodeParser, MessageBlockParser, QuestToken, MessageNode, DirectiveNode, SymbolNode, TaskNode, TaskType } from "../parser";
import { Parameter, QuestBlockKind, QuestResourceWithNode, QuestResourceWithParameters } from "./common";
import { ActionInfo, QuestResourceCategory, QuestResourceDetails, SymbolType } from "./static/common";
import { Language } from "./static/language";
import { LanguageData } from "./static/languageData";
import { Modules } from "./static/modules";
import { StaticData } from "./static/staticData";

/**
 * A directive inside the quest preamble.
 */
export class Directive implements QuestResourceWithNode<DirectiveNode>, QuestResourceWithParameters {

    /**
     * The name of this directive, for example `Quest` in `Quest: name`.
     */
    public get name(): string {
        return this.node.name.value;
    }

    /**
     * The range of the directive name.
     */
    public get range(): Range {
        return this.node.name.range;
    }

    public get blockRange(): Range {
        return this.node.range;
    }

    public get signature(): readonly Parameter[] {
        return [this.parameter];
    }

    public constructor(
        public readonly node: DirectiveNode,

        /**
         * The single parameter of the directive, for example `name` in `Quest: name`.
         */
        public readonly parameter: Parameter
    ) {
    }

    public getRange(index: number): Range {
        if (index !== 0) {
            throw new RangeError(`${index} is out of range.`);
        }

        return this.node.content.range;
    }

    public fromRange(range: Range): Parameter | undefined {
        if (range.isEqual(this.node.content.range)) {
            return this.parameter;
        }
    }

    /**
     * Attempts to parse a directive inside the preamble.
     * @param line A text line with a directive.
     * @param nodeParser Quest file parser.
     * @param language Language data.
     * @returns A `Directive` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, nodeParser: NodeParser, language: Language): Directive | undefined {
        const directiveNode: DirectiveNode | undefined = nodeParser.parseDirective(line);
        if (directiveNode !== undefined) {
            const questResourceDetails: QuestResourceDetails | undefined = language.findDirective(directiveNode.name.value);
            if (questResourceDetails !== undefined) {
                const match: RegExpMatchArray | null = questResourceDetails.signature.match(/[a-zA-Z]+: \${1:([a-zA-Z]+)}/);
                if (match !== null) {
                    const parameter = {
                        type: `\${${match[1]}}`,
                        value: directiveNode.content.value
                    };

                    return new Directive(directiveNode, parameter);
                }
            }
        }
    }
}

/**
 * A text block with an id.
 */
export class Message implements QuestResourceWithNode<MessageNode> {

    /**
     * The numeric id associated to this message.
    */
    public get id(): number {
        return Number(this.node.id.value);
    }

    /**
     * The range of the message id.
     */
    public get range(): Range {
        return this.node.id.range;
    }

    /**
     * The range of the message including its text block.
     */
    public get blockRange(): Range {
        return this.node.bodyRange.isEmpty === true ?
            this.node.range :
            this.node.range.union(this.node.bodyRange);
    }

    /**
     * A meaningful string that can be used to reference the message.
     */
    public get alias(): string | undefined {
        return this.node.alias?.value;
    }

    /**
     * The range of the message alias.
     */
    public get aliasRange(): Range | undefined {
        return this.node.alias?.range;
    }

    public constructor(
        public readonly node: MessageNode,
        private readonly details: QuestResourceDetails | undefined) {
    }

    /**
     * Adds the general description to the summary if this is a static message. 
     * @param summary The formatted comment block for this message.
     */
    public makeDocumentation(language: Language, summary?: string): string | undefined {
        if (this.details !== undefined) {
            summary = summary ? this.details.summary + EOL.repeat(2) + summary : this.details.summary;
        }

        return summary;
    }

    /**
     * Makes a compact but readable preview of the message, to be shown inside tooltips.
     * @param textBlockSeparationLine Adds an empty line between definition and text block for better readability.
     * @param maxLenght Maximum number of characters taken from the text block.
     */
    public makePreview(messageContent: string, textBlockSeparationLine: boolean, maxLenght: number = 150): string {
        const previewLines: string[] = [];

        previewLines.push(this.alias !== undefined ? `${this.alias}: [${this.id}]` : `Message: ${this.id}`);

        let lenght = 0;
        for (const line of messageContent.split(/(\r)?\n/, 5)) {
            if (line === undefined) {
                continue;
            }

            let text = line.replace('<ce>', '').trim();

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

        return previewLines.join(' ').trim();
    }

    /**
     * Attempts to parse a message definition.
     * @param line A text line with a message definition.
     * @param nodeParser Quest file parser.
     * @param language Language data.
     * @returns A `Message` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, nodeParser: NodeParser, language: Language): Message | undefined {
        const messageNode: MessageNode | undefined = nodeParser.parseMessage(line);
        if (messageNode !== undefined) {
            return new Message(messageNode, messageNode.alias !== undefined ? language.findMessage(messageNode.alias.value) : undefined);
        }
    }
}

/**
 * A symbol used by resources and tasks, and for text replacement inside messages.
 */
export class Symbol implements QuestResourceWithNode<SymbolNode>, QuestResourceWithParameters {

    /**
     * The string that allows to reference this symbol, declared with the definition.
     * It often includes a prefix and suffix: `_symbol_`.
     */
    public get name(): string {
        return this.node.name.value;
    }

    /**
     * What kind of resource is linked to this symbol.
     */
    public get type(): SymbolType {
        return this.node.type.value as SymbolType;
    }

    /**
     * The range of the symbol.
     */
    public get range(): Range {
        return this.node.name.range;
    }

    /**
     * The range of the line where the symbol is defined.
     */
    public get blockRange(): Range {
        return this.node.range;
    }

    public constructor(
        public readonly node: SymbolNode,
        public readonly signature: readonly Parameter[] | undefined
    ) {
    }

    public getRange(parameter: number | Parameter): Range {
        if (this.signature !== undefined) {
            if (typeof parameter === 'number') {
                if (parameter < 0 || parameter >= this.signature.length) {
                    throw new RangeError(`${parameter} is out of range.`);
                }

                parameter = this.signature[parameter];
            }

            if (this.node.pattern !== undefined) {
                const index = this.node.pattern.value.search(new RegExp(`\\b${parameter.value}\\b`));
                if (index !== -1) {
                    const lineNumber: number = this.node.pattern.position.line;
                    const wordPosition: number = this.node.pattern.position.character + index;
                    return new Range(lineNumber, wordPosition, lineNumber, wordPosition + parameter.value.length);
                }
            }
        }

        throw new Error(`Parameter ${parameter} not found.`);
    }

    public fromRange(range: Range): Parameter | undefined {
        if (this.node.pattern !== undefined && this.signature !== undefined) {
            const offset: number = range.start.character - this.node.pattern.range.start.character;
            const value: string = this.node.pattern.value.substring(offset, offset + range.end.character - range.start.character);
            return this.signature.find(x => x.value === value);
        }
    }

    /**
     * Attempts to parse a symbol definition.
     * @param line A text line with a symbol definition.
     * @param nodeParser Quest file parser.
     * @param language Language data.
     * @returns A `Symbol` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, nodeParser: NodeParser, language: Language): Symbol | undefined {
        const symbolNode: SymbolNode | undefined = nodeParser.parseSymbol(line);
        if (symbolNode !== undefined) {
            const signature = Symbol.parseSignature(symbolNode.type.value, line.text, language);
            return new Symbol(symbolNode, signature);
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
        if (definition !== undefined) {
            if (definition.matches && definition.matches.length > 0) {
                return definition.matches.reduce<Parameter[]>((parameters, word) => {
                    const match = text.match(word.regex);
                    if (match !== null) {
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
 * An action that belongs to a task and perform a specific function when task is active and conditions are met.
 */
export class Action implements QuestResourceWithNode<QuestToken>, QuestResourceWithParameters {
    public readonly signature: readonly Parameter[];
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

    public constructor(
        public readonly node: QuestToken,
        public readonly line: TextLine,
        info: ActionInfo) {

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

        const values = node.value.split(' ');
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
            const lineNumber: number = this.node.position.line;
            const wordPosition = this.node.position.character + this.findWordPosition(this.node.value, index);
            return new Range(lineNumber, wordPosition, lineNumber, wordPosition + this.signature[index].value.length);
        }

        return this.node.range;
    }

    public fromRange(range: Range): Parameter | undefined {
        const offset: number = range.start.character - this.node.range.start.character;
        const value: string = this.node.value.substring(offset, offset + range.end.character - range.start.character);
        return this.signature.find(x => x.value === value);
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
    public isInvocationOf(...args: readonly string[]) {
        return args.length <= this.signature.length &&
            args.find((arg, index) => arg !== this.signature[index].type) === undefined;
    }

    /**
     * Attempts to parse an action inside a task.
     * @param line A text line with an action.
     * @param nodeParser Quest file parser.
     * @param modules Imported language data.
     * @returns An `Action` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, nodeParser: NodeParser, modules: Modules): Action | undefined {
        const actionInfo: ActionInfo | undefined = modules.findAction(line.text);
        if (actionInfo !== undefined) {
            return new Action(nodeParser.parseToken(line), line, actionInfo);
        }
    }

    /**
     * Finds the char index of a word in a string.
     * For example wordIndex 2 in `give item _note_ to _vampleader_` is 5.
     */
    private findWordPosition(text: string, wordIndex: number): number {
        let insideWord = false;
        for (let i = 0; i < text.length; i++) {
            if (!/\s/.test(text[i])) {
                if (!insideWord) {
                    if (wordIndex-- === 0) {
                        return i;
                    }
                    insideWord = true;
                }
            }
            else {
                if (insideWord) {
                    insideWord = false;
                }
            }
        }

        return 0;
    }
}

/**
 * A group of actions that can be executed, with a flag for its triggered state.
 * When the action list is empty, the task is used as a set/unset variable.
 */
export class Task implements QuestResourceWithNode<TaskNode> {

    /**
     * The string that allows to reference this task, declared with the definition.
     * It often includes a prefix and suffix: `_symbol_`.
     */
    public get name(): string {
        return this.node.symbol.value;
    }

    /**
     * The range of the symbol of this task.
     */
    public get range(): Range {
        return this.node.symbol.range;
    }

    /**
     * The actions block owned by this task.
     */
    public readonly actions: Action[] = [];

    /**
     * True if this task is declared as a variable.
     */
    public get isVariable(): boolean {
        return this.node.type === TaskType.Variable
            || this.node.type === TaskType.GlobalVarLink;
    }

    /**
     * The range of the task with its actions block.
     */
    public get blockRange(): Range {
        return this.actions.length === 0 ?
            this.node.range :
            this.node.range.union((this.actions[this.actions.length - 1].blockRange));
    }

    public constructor(public readonly node: TaskNode) {
    }

    /**
     * Does this task have at least one condition?
     */
    public hasAnyCondition(modules: Modules): boolean {
        return !!this.actions.find(action => {
            const actionInfo = modules.findAction(action.node.value);
            return !!(actionInfo && actionInfo.category === QuestResourceCategory.Condition);
        });
    }

    /**
     * Checks if at least one action is fully within the given range
     * and there are no actions which are only partially inside.
     * @param range A range between the first and the last action of this task.
     * @returns True if range fully contains one or more actions.
     * @example 
     * 'clicked item _item_'  // true
     * 'cked item _item_'     // false
     */
    public isValidSubRange(range: Range): boolean {
        const first = this.actions.find(x => x.node.position.line === range.start.line);
        const last = this.actions.find(x => x.node.position.line === range.end.line);

        return first !== undefined && range.start.isBeforeOrEqual(first.node.position) &&
            last !== undefined && range.end.isAfterOrEqual(last.node.range.end);
    }

    /**
     * Attempts to parse a task definition.
     * @param line A text line with a task definition.
     * @param nodeParser Quest file parser.
     * @returns A `Task` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(line: TextLine, nodeParser: NodeParser): Task | undefined {
        const taskNode: TaskNode | undefined = nodeParser.parseTask(line);
        if (taskNode !== undefined) {
            return new Task(taskNode);
        }
    }
}


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

export interface QuestParseContext {
    readonly data: LanguageData;
    readonly document: TextDocument;
    readonly nodeParser: NodeParser;
    block: QuestBlock;
    blockStart: number;
    currentMessageBlock?: MessageBlockParser;
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
    public readonly failedParse: QuestToken[] = [];

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
