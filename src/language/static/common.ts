/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

/**
 * Kinds of resources usable in a quest.
 */
export enum QuestResourceCategory {
    Keyword,
    Message,
    Definition,
    Symbol,
    Task,
    Condition,
    Action,
    GlobalVar
}

/**
 * Specifications of a quest resource.
 */
export interface QuestResourceDetails {

    /**
    * A short description for this resource.
    */
    readonly summary: string;

    /**
     * The signature for this resource.
     */
    readonly signature: string;
}

/**
 * A quest resorce defined by the language.
 */
export interface QuestResourceInfo {

    /**
     * The kind of resource.
    */
    readonly category: QuestResourceCategory;

    /**
     * Specifications of the quest resource.
     */
    readonly details: QuestResourceDetails;
}

/**
 * A match for a parameter.
 */
export interface ParameterMatch {
    
    /**
     * A regular expression that matches a parameter in a signature.
     */
    readonly regex: string;

    /**
     * The type that corresponds to the match.
     */
    readonly signature: string;
}

/**
 * A parameter in a signature.
 */
export interface ParameterInfo {

    /**
     * The name of this parameter.
     */
    readonly name: string;

    /**
     * A short description for the parameter.
     */
    readonly description: string;
}

/**
 * A definition for a symbol type.
 */
export interface SymbolInfo {

    /**
     * The snippet that builds the symbol definition.
     */
    snippet: string;

    /**
     * A readable signature.
     */
    signature: string;

    /**
     * A regular expression that matches the definition signature.
     */
    match: string;

    /**
     * Matches for individual parameters.
     */
    matches: ParameterMatch[];

    /**
     * A short description for this symbol type.
     */
    summary: string;

    /**
    * Parameters for the signature of this symbol.
    */
    parameters: ParameterInfo[];
}

/**
 * Specifications of an action.
 */
export interface ActionDetails {

    /**
     * A short description for this action.
     */
    readonly summary: string;

    /**
     * All variations of this action.
     */
    readonly overloads: string[];
}

/**
 * An action imported from a module.
 */
export class ActionInfo {

    public constructor(

        /**
         * The name of the module that owns this action.
         */
        public readonly moduleName: string,

        /**
         * The kind of action.
         */
        public readonly category: QuestResourceCategory,

        /**
         * Specifications of this action.
         */
        public readonly details: ActionDetails,

        /**
         * Index of the used signature variation.
         */
        public overload: number = 0, ) {
    }

    /**
     * Gets the used signature variation.
     */
    public getSignature() {
        return this.details.overloads[this.overload];
    }
}