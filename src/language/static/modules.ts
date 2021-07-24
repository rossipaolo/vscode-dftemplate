/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as parser from '../../parser';
import { StaticData, StaticDataLoader } from './staticData';
import { tryParseWhenTaskCondition } from './whenTask';
import { getOptions, select, where } from '../../extension';
import { QuestResourceCategory, ActionDetails, ActionInfo } from './common';
import { Module } from 'module';

/**
 * A module with language actions and other content.
 */
export interface Module {

    /**
     * A readable name for the module.
     */
    readonly displayName: string;

    /**
     * Conditions defined by this module.
     */
    readonly conditions?: readonly ActionDetails[];

    /**
     * Actions defined by this module.
     */
    readonly actions?: readonly ActionDetails[];
    
    /**
     * Effect names.
     */
    readonly effects?: readonly string[];
}

/**
 * A loader of language modules.
 */
export interface ModulesLoader {
    
    /**
     * Loads content of language modules.
     * @param moduleNames Names of modules to be loaded.
     */
    loadModules(moduleNames: readonly string[]): Promise<Module[]>;
}

/**
 * Loads action/condition modules from json files.
 */
export class JsonModulesLoader extends StaticDataLoader implements ModulesLoader {
    public constructor(private readonly extensionPath: string) {
        super();
    }

    /**
     * Loads the requested modules, seeked from the extension resources and a folder named _Modules_
     * inside the root directory of the workspace.
     * @param moduleNames A list of module names without `.dfmodule.json` extension.
     * @param extensionPath The extension path.
     */
    public async loadModules(moduleNames: readonly string[]): Promise<Module[]> {
        return (await Promise.all(moduleNames.map(async name => {
            name = name + '.dfmodule.json';

            try {
                let modulePath = path.join(this.extensionPath, 'modules', name);
                if (fs.existsSync(modulePath)) {
                    return await this.parseFromJson<Module>(modulePath);
                }

                if (vscode.workspace.workspaceFolders) {
                    modulePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'Modules', name);
                    if (fs.existsSync(modulePath)) {
                        return await this.parseFromJson<Module>(modulePath);
                    }
                }

                vscode.window.showErrorMessage('Failed to find module ' + name + '.');
            } catch (e) {
                vscode.window.showErrorMessage('Failed to import module ' + name + ': ' + e);
            }

        }))).filter((x): x is Module => !!x);
    }
}

/**
 * Manage imported modules for intellisense.
 */
export class Modules extends StaticData {

    private modules: Module[] = [];

    private static queries = [
        { fromModule: (module: Module) => module.conditions, kind: QuestResourceCategory.Condition },
        { fromModule: (module: Module) => module.actions, kind: QuestResourceCategory.Action }
    ];

    /**
     * Load all enabled modules.
     * @param modulesLoader Loader of language modules.
     */
    public async load(modulesLoader: ModulesLoader): Promise<void> {
        this.modules = await modulesLoader.loadModules(getOptions()['modules']);
    }

    /**
     * Find the action referenced in a line of a task.
     * @param text All text that contains a call to action.
     * @param prefix Trigger word. If omitted, this is the first word of the string.
     */
    public findAction(text: string, prefix?: string): ActionInfo | undefined {
        if (prefix || (prefix = parser.getFirstWord(text))) {
            for (const result of this.findActions(prefix, true)) {
                const overload = result.details.overloads.findIndex(x => text.match(Modules.makeRegexFromSignature(x)) !== null);
                if (overload !== -1) {
                    result.overload = overload;
                    return result;
                }
            }

            return tryParseWhenTaskCondition(text);
        }
    }

    /**
     * Find all actions that start with the given word or have a parameter as first word.
     * @param prefix Start of signature.
     * @param allowParameterAsFirstWord Accepts an action if the first word is a paremeter.
     */
    public *findActions(prefix: string, allowParameterAsFirstWord: boolean = false): Iterable<ActionInfo> {
        for (const module of this.modules) {
            for (const query of Modules.queries) {
                const actions = query.fromModule(module);
                if (actions) {
                    for (const action of actions) {
                        if (action.overloads[0].startsWith(prefix) || (allowParameterAsFirstWord && action.overloads[0].startsWith('$'))) {
                            yield new ActionInfo(module.displayName, query.kind, action);
                        }
                    }
                }
            }
        }
    }

    /**
     * Finds actions and modules that starts with the given string (case insensitive) and returns their signature.
     */
    public *caseInsensitiveSeek(prefix: string): Iterable<string> {
        prefix = prefix.toUpperCase();
        for (const module of this.modules) {
            if (module.conditions !== undefined) {
                yield* select(where(module.conditions, x => x.overloads[0].toUpperCase().startsWith(prefix)), x => x.overloads[0]);
            }
            if (module.actions !== undefined) {
                yield* select(where(module.actions, x => x.overloads[0].toUpperCase().startsWith(prefix)), x => x.overloads[0]);
            }
        }
    }

    public getActionInfo(predicate: (actionDetails: ActionDetails) => boolean): ActionInfo | undefined {
        for (const module of this.modules) {
            for (const query of Modules.queries) {
                const actions = query.fromModule(module);
                if (actions) {
                    const action = actions.find(predicate);
                    if (action !== undefined) {
                        return new ActionInfo(module.displayName, query.kind, action);
                    }
                }
            }
        }
    }

    /**
     * Checks if an effect key is defined inside a module.
     */
    public effectKeyExists(effectKey: string): boolean {
        return this.modules.find(x => x.effects !== undefined && x.effects.includes(effectKey) === true) !== undefined;
    }

    /**
     * Gets all effect keys that start with the given prefix (case insensitive).
     */
    public *getEffectKeys(prefix: string): Iterable<string> {
        prefix = prefix.toUpperCase();
        for (const module of this.modules) {
            if (module.effects !== undefined) {
                yield* where(module.effects, x => x.toUpperCase().startsWith(prefix));
            }
        }
    }

    /**
     * Checks if a word is the name of an action. The name is the first word in signature
     * that is not a parameter. Multiple actions can have the same name.
     */
    public static isActionName(actionResult: ActionInfo, word: string) {
        const overload = actionResult.getSignature();
        return overload.startsWith(word) || overload.split(' ').find(x => !x.startsWith('$')) === word;
    }
}