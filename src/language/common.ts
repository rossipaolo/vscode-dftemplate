/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { Parameter, SignatureWord } from "../diagnostics/signatureCheck";
import { Range, TextLine } from "vscode";
import { TaskDefinition } from "../parsers/parser";

/**
 * A symbol used by resources and tasks, and for text replacement inside messages.
 */
export class Symbol {

    public signature: Parameter[] | null = null;

    public constructor(
        public type: string,
        public range: Range,
        public line: TextLine) {
    }

    /**
     * Parses the symbol definition and retrieve its parameters.
     * @param signature Regex that matches parameter.
     */
    public parse(signature: SignatureWord[]): void {
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
export interface Task {
    range: Range;
    definition: TaskDefinition;
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
}

/**
 * A text block with a serial number. Can be used for popups, journal, letters, and rumours.
 */
export interface Message {
    id: number;
    alias: string | undefined;
    range: Range;
    otherRanges: Range[] | undefined;
}

/**
 * A block of a quest.
 */
export abstract class QuestBlock {
    public found: boolean = false;
    public readonly failedParse: TextLine[] = [];
}

