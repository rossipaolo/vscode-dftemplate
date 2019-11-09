/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Kinds of resources usable in a quest.
 */
export enum QuestResourceCategory {
    Directive,
    Message,
    Definition,
    Symbol,
    Task,
    Condition,
    Action,
    GlobalVar
}

/**
 * Types of symbol resources.
 */
export const enum SymbolType {
    Item = 'Item',
    Person = 'Person',
    Place = 'Place',
    Clock = 'Clock',
    Foe = 'Foe'
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
 * A list of overloads where one is defined as selected.
 */
export interface Overload<T> {
    
    /**
     * All the overloads.
     */
    readonly all: T[];

    /**
     * The index of the selected overload.
     */
    readonly index: number;
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
 * A variation of a symbol, used inside QRC message blocks.
 */
export interface SymbolVariation {

    /**
     * The symbol with a prefix and a suffix.
     */
    readonly word: string;

    /**
     * A description for the meaning of this variation.
     */
    readonly description: string;
}

/**
 * Specifications of an action.
 */
export interface ActionDetails {

    /**
     * A short description for this action.
     */
    readonly summary: string | string[];

    /**
     * All variations of this action.
     */
    readonly overloads: string[];

    /**
     * If true this action should be removed or replaced.
     */
    readonly isObsolete?: boolean | boolean[];

    /**
     * The name of the C# class that defines this action and its filename.
     */
    readonly sourceName?: string | null;
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
        public overload: number = 0) {
    }

    /**
     * Gets the used signature variation.
     */
    public getSignature() {
        return this.details.overloads[this.overload];
    }

    /**
     * Gets the summary for this overload or a different overload for this action.
     * @param overload The index of the overload or undefined.
     */
    public getSummary(overload?: number) {
        return Array.isArray(this.details.summary) ?
            this.details.summary[overload !== undefined ? overload : this.overload] :
            this.details.summary;
    }

    /**
     * Checks if the used overload is obsolete.
     */
    public isObsolete(): boolean {
        const isObsolete = Array.isArray(this.details.isObsolete) ?
            this.details.isObsolete[this.overload] :
            this.details.isObsolete;

        return isObsolete === true;
    }

    /**
     * Compare this action info to another one and returns true if they are the same overload
     * or two different overload of the same action. Returns false if they are different actions.
     * @param other Another action info.
     */
    public isSameAction(other: ActionInfo) {
        if (this.details.sourceName === 'WhenTask' && other.details.sourceName === 'WhenTask') {
            return true;
        }
        
        if (this.details.overloads.length !== other.details.overloads.length) {
            return false;
        }

        for (let index = 0; index < this.details.overloads.length; index++) {
            if (this.details.overloads[index] !== other.details.overloads[index]) {
                return false;
            }
        }

        return true;
    }
}

export async function readTextFile(path: string): Promise<string> {
    const readFile = require('util').promisify(fs.readFile);
    return await readFile(path, { encoding: 'utf8' });
}

export async function readTextFileLines(path: string): Promise<string[]> {
    const text = await readTextFile(path);
    return text.split(/\r?\n/);
}

/**
 * Finds the path to a folder inside current workspace from its relative path.
 * @param relPath A relative path from any of the workspace folders.
 * @returns Full path to folder or undefined if it doesn't exist.
 */
export async function findWorkspaceSubFolder(relPath: string): Promise<string | undefined> {
    if (vscode.workspace.workspaceFolders !== undefined) {
        const pathExists = require('util').promisify(fs.exists);
        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            const folder = path.join(workspaceFolder.uri.fsPath, relPath);
            if (await pathExists(folder) === true) {
                return folder;
            }
        }
    }
}