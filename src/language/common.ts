/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { Range } from "vscode";
import { QuestNode } from "../parser";
import { Language } from "./static/language";

/**
 * A resource found in a quest.
 */
export interface QuestResource {

    /**
     * The range of the symbol declaration.
     */
    readonly range: Range;

    /**
     * The range of the entire definition.
     */
    readonly blockRange: Range;

    /**
     * Finalises the documentation for this resources.
     */
    readonly makeDocumentation?: (language: Language, summary?: string) => string | undefined;
}

/**
 * A resource found in a quest with a syntax node.
 */
export interface QuestResourceWithNode<TNode extends QuestNode> extends QuestResource {

    /**
     * The syntax node that defines this resource in the source file.
     */
    readonly node: TNode;
}

/**
 * A parameter in a resource signature.
 */
export interface Parameter {

    /**
     * One of the types defined in {@link ParameterTypes} or equal to value if it's a constant keyword.
     */
    readonly type: string;

    /**
     * The value of the parameter.
     */
    readonly value: string;
}

/**
 * A resource that accepts parameters.
 */
export interface QuestResourceWithParameters {

    /**
     * A list of parameters, which can be empty, or `undefined` if not parsed correctly.
     */
    readonly signature: readonly Parameter[] | undefined;

    /**
     * Gets the range of a parameter.
     * @param index The number of parameter in `[0, signature.length)`.
     * @returns The range of the parameter.
     * @throws {RangeError} Index out of range.
     */
    readonly getRange: (index: number) => Range;

    /**
     * Seeks a parameter from its range.
     * @param range A range in the document.
     * @returns Parameter at range or `undefined`.
     */
    readonly fromRange: (range: Range) => Parameter | undefined;
}

export enum QuestBlockKind {
    Preamble,
    QRC,
    QBN
}