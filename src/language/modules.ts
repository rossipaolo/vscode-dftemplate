/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { ExtensionContext } from 'vscode';
import { Options, parseFromJson } from '../extension';

// Standard variables for signatures in modules.
// Might be used for diagnostic in the future.
// SYMBOL_ANY = '_symbol_';
// SYMBOL_PERSON = '_person_';
// SYMBOL_ITEM = '_item_';
// SYMBOL_FOE = '_foe_';
// SYMBOL_CLOCK = '_clock_';
// NUMBER_GENERIC = 'dd';
// NUMBER_HOUR = 'hh';
// NUMBER_MINUTES = 'mm';
// STRING = 'ww';
// MESSAGE_ANY = 'message';
// MESSAGE_ID = 'messageID';
// MESSAGE_NAME = 'messageName';
// TASK = 'task';
// QUEST_INDEX = 'questID';
// QUEST_NAME = 'questName';

interface Action {
    summary: string;
    match: string;
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
}

/**
 * Manage imported modules for intellisense.
 */
export class Modules {

    private modules: Module[] = [];

    private static instance: Modules | null;

    public static readonly ActionKind = {
        Condition: 'condition',
        Action: 'action'
    };

    /**
     * Load all enabled modules.
     * @param context Current context of extension.
     */
    public load(context: ExtensionContext) {
        Modules.loadModules(Options.modules, context).then((modules) => {
            this.modules = modules;
        });
    }

    /**
     * Find the action referenced in a line of a task.
     * @param prefix Trigger word.
     * @param text All text that contains a call to action.
     */
    public findAction(prefix: string, text: string): ActionResult | undefined {
        for (const result of this.findActions(prefix)) {
            for (let i = 0; i < result.action.overloads.length; i++) {
                if (text.match(Modules.makeRegexFromSignature(result.action.overloads[i]))) {
                    result.overload = i;
                    return result;
                }
            }
        }
    }

    /**
     * Find all actions that start with the given string.
     * @param prefix Start of signature.
     */
    public *findActions(prefix: string): Iterable<ActionResult> {
        for (const module of this.modules) {
            if (module.conditions) {
                for (const condition of Modules.filterActions(module.conditions, prefix)) {
                    yield { moduleName: module.displayName, actionKind: Modules.ActionKind.Condition, action: condition, overload: 0 };
                }
            }
            if (module.actions) {
                for (const action of Modules.filterActions(module.actions, prefix)) {
                    yield { moduleName: module.displayName, actionKind: Modules.ActionKind.Action, action: action, overload: 0 };
                }
            }
        }
    }

    public static getInstance(): Modules {
        return Modules.instance ? Modules.instance : Modules.instance = new Modules();
    }

    public static release(){
        Modules.instance = null;
    }

    /**
     * Convert a snippet string to a pretty signature definition.
     */
    public static prettySignature(signature: string): string {
        return signature.replace(/\${\d(:|\|)?/g, '').replace(/\|?}/g, '');
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

        return parseFromJson(path).then((obj) => {
            return obj;
        }, () => vscode.window.showErrorMessage('Failed to import module ' + path + '.'));
    }

    private static *filterActions(actions: Action[], prefix: string) {
        for (const action of actions) {
            if (action.overloads[0].startsWith(prefix)) {
                yield action;
            }
        }
    }

    private static makeRegexFromSignature(signature: string): RegExp {
        signature = signature.replace(/\${\d\|/g, '(').replace(/\|}/g, ')').replace(/,/g, '|'); // ${d|a,b|} -> (a|b)
        signature = signature.replace(/\${\d:[a-zA-Z0-9_]+?}/g, '[a-zA-Z0-9_]+');               // ${d:a}    -> [a-zA-Z0-9_]+
        return new RegExp('^\\s*' + signature + '\\s*$');
    }
}