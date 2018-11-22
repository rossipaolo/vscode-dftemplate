/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { ExtensionContext } from 'vscode';
import { TablesManager } from './base/tablesManager';
import { BooleanExpression } from './booleanExpression';
import { getOptions, select, where } from '../extension';

interface Action {
    summary: string;
    overloads: string[];
}

export interface ActionResult {
    moduleName: string;
    actionKind: string;
    action: Action;
    overload: number;
}

export interface Module {
    displayName: string;
    conditions: Action[];
    actions: Action[];
    effects: string[];
}

/**
 * Manage imported modules for intellisense.
 */
export class Modules extends TablesManager {

    private modules: Module[] = [];

    private static instance: Modules | null;

    public static readonly ActionKind = {
        Condition: 'condition',
        Action: 'action'
    };

    private static queries = [
        { fromModule: (module: Module) => module.conditions, kind: Modules.ActionKind.Condition },
        { fromModule: (module: Module) => module.actions, kind: Modules.ActionKind.Action }
    ];

    /**
     * Load all enabled modules.
     * @param context Current context of extension.
     */
    public load(context: ExtensionContext): Promise<void> {
        var instance = this;
        return new Promise((resolve) => {
            Modules.loadModules(getOptions()['modules'], context).then((modules) => {
                instance.modules = modules;
                return resolve();
            }, () => vscode.window.showErrorMessage('Failed to import modules.'));
        });
    }

    /**
     * Find the action referenced in a line of a task.
     * @param text All text that contains a call to action.
     * @param prefix Trigger word. If omitted, this is the first word of the string.
     */
    public findAction(text: string, prefix?: string): ActionResult | undefined {
        if (prefix || (prefix = parser.getFirstWord(text))) {
            for (const result of this.findActions(prefix, true)) {
                const overload = result.action.overloads.findIndex(x => text.match(Modules.makeRegexFromSignature(x)) !== null);
                if (overload !== -1) {
                    result.overload = overload;
                    return result;
                }
            }

            if (BooleanExpression.match(prefix, text)) {
                return BooleanExpression.makeResult(text);
            }
        }
    }

    /**
     * Find all actions that start with the given word or have a parameter as first word.
     * @param prefix Start of signature.
     * @param allowParameterAsFirstWord Accepts an action if the first word is a paremeter.
     */
    public *findActions(prefix: string, allowParameterAsFirstWord:boolean = false): Iterable<ActionResult> {
        for (const module of this.modules) {
            for (const query of Modules.queries) {
                const actions = query.fromModule(module);
                if (actions) {
                    for (const action of actions) {
                        if (action.overloads[0].startsWith(prefix) || (allowParameterAsFirstWord && action.overloads[0].startsWith('$'))) {
                            yield { moduleName: module.displayName, actionKind: query.kind, action: action, overload: 0 };
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
            yield* select(where(module.conditions, x => x.overloads[0].toUpperCase().startsWith(prefix)), x => x.overloads[0]);
            yield* select(where(module.actions, x => x.overloads[0].toUpperCase().startsWith(prefix)), x => x.overloads[0]);
        }
    }

    /**
     * Checks if an effect key is defined inside a module.
     */
    public effectKeyExists(effectKey: string): boolean {
        for (const module of where(this.modules, x => x.effects !== undefined)) {
            if (module.effects.indexOf(effectKey) !== -1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Gets all effect keys that start with the given prefix (case insensitive).
     */
    public *getEffectKeys(prefix: string): Iterable<string> {
        prefix = prefix.toUpperCase();
        for (const module of where(this.modules, x => x.effects !== undefined)) {
            yield* where(module.effects, x => x.toUpperCase().startsWith(prefix));
        }
    }

    public static getInstance(): Modules {
        return Modules.instance ? Modules.instance : Modules.instance = new Modules();
    }

    public static release() {
        Modules.instance = null;
    }

    /**
     * Checks if a word is the name of an action. The name is the first word in signature
     * that is not a parameter. Multiple actions can have the same name.
     */
    public static isActionName(actionResult: ActionResult, word: string) {
        const overload = actionResult.action.overloads[actionResult.overload];
        return overload.startsWith(word) || overload.split(' ').find(x => !x.startsWith('$')) === word;
    }

    private static loadModules(paths: string[], context: ExtensionContext): Thenable<Module[]> {
        var modules = [];
        for (const path of paths) {
            modules.push(Modules.loadModule(path, context));
        }
        return Promise.all(modules);
    }

    private static loadModule(path: string, context: ExtensionContext): Thenable<Module> {
        path = path.replace('${extensionPath}', context.extensionPath);
        if (vscode.workspace.workspaceFolders) {
            path = path.replace('${workspaceFolder}', vscode.workspace.workspaceFolders[0].uri.fsPath);
        }

        return Modules.parseFromJson(path).then((obj) => {
            return obj;
        }, () => vscode.window.showErrorMessage('Failed to import module ' + path + '.'));
    }
}