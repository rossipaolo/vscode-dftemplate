/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { IContext } from '../../extension';
import { Tables } from "./tables";
import { Language } from "./language";
import { Modules } from "./modules";
import { findWorkspaceSubFolder } from './common';

/**
 * Result of a query to the Quest Engine parser.
 */
export type EngineQueryResult = Promise<vscode.Location | undefined>;

/**
 * Holder for all the language data.
 */
export class LanguageData {

    /**
     * Tables imported from `StreamingAssets/Tables`.
     */
    public readonly tables = new Tables();

    /**
     * Data shipped with the extension.
     */
    public readonly language = new Language(this.tables);

    /**
     * Imported modules with actions/conditions and other data.
     */
    public readonly modules = new Modules();

    /**
     * If current workspace includes Daggerfall Unity source project,
     * this object can provide basic C# parsing for Quest Engine queries.
     */
    public readonly questEngine: QuestEngine;

    private constructor(context: IContext) {
        this.questEngine = new QuestEngine(context);
    }

    /**
     * Loads all the language data.
     * @param context Context of the running extension.
     */
    public static async load(context: IContext): Promise<LanguageData> {
        const data = new LanguageData(context);
        await Promise.all([
            data.tables.load(),
            data.language.load(context),
            data.modules.load(context)
        ]);
        return data;
    }
}

/**
 * Daggerfall Unity Quest Engine.
 */
class QuestEngine {

    /**
     * The folder that contains C# scripts for Daggerfall Unity quest engine.
     * null if current workspace doesn't include this folder, undefined if not seeked yet.
     */
    private questingFolder: string | null | undefined = undefined;

    public constructor(context: IContext) {
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.questingFolder = undefined;
        }));
    }

    /**
     * Finds the location of C# definition of a TEMPLATE symbol.
     * @param name The name of a symbol type.
     */
    public findSymbolType(name: string): EngineQueryResult {
        return this.getCsharpResourceLocation(`${name}.cs`, name);
    }

    /**
     * Finds the location of C# definition of a TEMPLATE action.
     * @param name The name of an action type.
     */
    public findAction(name: string): EngineQueryResult {
        return this.getCsharpResourceLocation(`Actions/${name}.cs`, name);
    }

    /**
     * Finds the location of the definition of a C# class inside its file.
     * This is `Foo` in `public class Foo`;
     * @param uri Uri of a C# script inside current workspace.
     * @param name The name of class seeked.
     */
    public async findCsharpClassLocation(uri: vscode.Uri, name: string): EngineQueryResult {
        const document = await vscode.workspace.openTextDocument(uri);
        const regex = new RegExp(`\\bpublic\\s+class\\s+${name}\\b`);
        for (let i = 0; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;
            if (regex.test(text)) {
                const index = text.indexOf(name);
                if (index !== -1) {
                    return new vscode.Location(uri, new vscode.Range(i, index, i, index + name.length));
                }
            }
        }
    }

    /**
     * Finds the location of a C# resource used by Daggerfall Unity quest engine.
     * Current workspace must include Daggerfall Unity project as a root folder, otherwise undefined is returned.
     * @param relPath Relative path to resource file rooted at `Questing` folder.
     * @param name Name of resource class type.
     */
    private async getCsharpResourceLocation(relPath: string, name: string): EngineQueryResult {
        if (this.questingFolder === undefined && (this.questingFolder = await findWorkspaceSubFolder('Assets/Scripts/Game/Questing/')) === undefined) {
            this.questingFolder = null;
        }

        if (this.questingFolder !== null) {
            return this.findCsharpClassLocation(vscode.Uri.parse('file:' + path.join(this.questingFolder, relPath)), name);
        }
    }
}