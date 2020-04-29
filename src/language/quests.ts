/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { TEMPLATE_LANGUAGE } from '../extension';
import { subRange } from '../parser';
import { LanguageData } from './static/languageData';
import { Quest } from './quest';
import { QuestTable } from './questTable';
import { SaveInspector } from './saveInspector';

/**
 * Manages quest files inside a workspace.
 */
export class Quests {

    /**
     * Cached quests with their uris.
     */
    private readonly quests = new Map<string, Quest>();

    /**
     * Uris of all quest files or undefined if they need to be seeked.
     */
    private uris: Uri[] | undefined = undefined;

    /**
     * Cached quest tables with their uris.
     */
    private readonly tables = new Map<string, QuestTable>();

    /**
     * A loading operation in progress.
     */
    private loadingQuests: Promise<Quest[] | undefined> | undefined;

    public readonly saveInspector: SaveInspector;

    private readonly _onDidParseQuest = new vscode.EventEmitter<Quest>();
    public get onDidParseQuest(): vscode.Event<Quest> {
        return this._onDidParseQuest.event;
    }

    public constructor(context: vscode.ExtensionContext, private readonly data: LanguageData) {
        this.saveInspector = new SaveInspector(context.subscriptions);
    }

    /**
     * Registers to documents events.
     */
    public initialize(): vscode.Disposable {
        const fsWatcher = vscode.workspace.createFileSystemWatcher('**/*.txt', false, true, false);
        fsWatcher.onDidCreate(uri => {
            if (this.uris) {
                this.uris.push(uri);
            }
        });
        fsWatcher.onDidDelete(uri => {
            this.uris = undefined;
            if (!this.quests.delete(uri.fsPath)) {
                this.tables.delete(uri.fsPath);
            }
        });

        const event = vscode.window.onDidChangeActiveTextEditor(textEditor => {
            if (this.saveInspector.isSetup && textEditor !== undefined && textEditor.document.languageId === TEMPLATE_LANGUAGE) {
                this.saveInspector.refresh(textEditor, this.getIfQuest(textEditor.document));
            }
        });

        return vscode.Disposable.from(fsWatcher, event);
    }

    /**
     * Checks if a quest file exist within the current workspace.
     * @param uri The uri of a quest file.
     */
    public async questExist(uri: vscode.Uri): Promise<boolean> {
        return (await this.getUris()).find(x => x.fsPath === uri.fsPath) !== undefined;
    }

    /**
     * Gets a `Quest` instance for the given document.
     * @param document A text document with a quest to be parsed.
     */
    public get(document: vscode.TextDocument): Quest {
        let quest = this.quests.get(document.uri.fsPath);
        if (!quest || document.version > quest.version) {
            this.quests.set(document.uri.fsPath, quest = new Quest(document, this.data));
            this._onDidParseQuest.fire(quest);
        }

        return quest;
    }

    /**
     * Gets a `Quest` instance for the given document if is actually a quest file.
     * @param document A text document with a quest to be parsed.
     */
    public getIfQuest(document: vscode.TextDocument): Quest | undefined {
        if (!Quests.isTable(document.uri)) {
            return this.get(document);
        }
    }

    /**
     * Gets all quests in the current workspace.
     * @param token An optional cancellation token.
     * @returns A list of quests which is empty if operation was cancelled.
     */
    public async getAll(token?: vscode.CancellationToken): Promise<Quest[]> {

        if (this.loadingQuests !== undefined) {
            const quests = await this.loadingQuests;
            if (token && token.isCancellationRequested) {
                return [];
            } else if (quests !== undefined) {
                return quests;
            }
        }

        const quests = await (this.loadingQuests = this.loadQuests(token));
        this.loadingQuests = undefined;
        return quests !== undefined ? quests : [];
    }

    /**
     * Gets a `QuestTable` instance for the given document.
     * @param document A text document with a quest table to be parsed.
     */
    public getTable(document: vscode.TextDocument): QuestTable {
        let table = this.tables.get(document.uri.fsPath);
        if (!table || document.version > table.version) {
            this.tables.set(document.uri.fsPath, table = new QuestTable(document));
        }

        return table;
    }

    /**
     * Finds the quest referenced by an entry of a quest table.
     * @param document A document with a quest table.
     * @param position A position in the quest table where the name of a quest can be foun.
     * @param token An optional cancellation toke.
     */
    public async findFromTable(document: vscode.TextDocument, position: vscode.Position, token?: vscode.CancellationToken): Promise<Quest | undefined> {
        const table = this.getTable(document);
        if (table.hasQuests) {
            const entry = table.content.find(x => subRange(x.range, x.text, x.value).contains(position));
            if (entry) {
                return this.find(entry.value, token);
            }
        }
    }

    /**
     * Finds a quest with the given file name.
     * @param name `NAME` inside `./NAME.txt` or the index inside `./S000NNNN.txt`.
     * @param token An optional cancellation token.
     */
    public async find(name: string, token?: vscode.CancellationToken): Promise<Quest | undefined> {
        const uris = await this.getUris(token);
        if (uris !== undefined) {
            name = Quest.indexToName(name);
            const uri = uris.find(x => Quest.uriToName(x) === name);
            if (uri !== undefined) {
                return this.quests.get(uri.fsPath) || this.get(await vscode.workspace.openTextDocument(uri));
            }
        }

        return undefined;
    }

    /**
     * Retrieves all quests in the current workspace. If not cached they will be opened and parsed.
     * @param token An optional cancellation token.
     * @returns A list of quests or undefined if operation was cancelled.
     */
    private async loadQuests(token?: vscode.CancellationToken): Promise<Quest[] | undefined> {
        const uris = await this.getUris(token);
        if (uris === undefined) {
            return undefined;
        }

        const quests: Quest[] = [];
        let progressStatusBar: Thenable<any> | undefined;

        for (const uri of uris) {
            const quest = this.quests.get(uri.fsPath);
            if (quest) {
                quests.push(quest);
            } else {

                const document = await vscode.workspace.openTextDocument(uri);
                if (document && document.languageId === TEMPLATE_LANGUAGE) {
                    quests.push(this.get(document));
                }

                if (token && token.isCancellationRequested) {
                    return undefined;
                }

                if (progressStatusBar === undefined) {
                    progressStatusBar = vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async progress => {
                        progress.report({ message: 'Analysing quests' });
                        return this.loadingQuests;
                    });
                }
            }
        }

        return quests;
    }

    /**
     * Gets cached uris of all quests in the workspace or find them.
     */
    private async getUris(): Promise<Uri[]>;
    private async getUris(token?: vscode.CancellationToken): Promise<Uri[] | undefined>;
    private async getUris(token?: vscode.CancellationToken): Promise<Uri[] | undefined> {
        if (this.uris === undefined) {
            const uris = await vscode.workspace.findFiles('**/*.txt', undefined, undefined, token);
            if (token && token.isCancellationRequested) {
                return undefined;
            }

            this.uris = uris.filter(x => !Quests.isTable(x));
        }

        return this.uris;
    }

    /**
     * Checks if the given uri corresponds to a quests table.
     * @param uri A document uri.
     */
    public static isTable(uri: vscode.Uri): boolean {
        return /Quest(s|List)-(.)+\.txt$/.test(uri.fsPath);
    }

    /**
     * Gets the schema of a table.
     * @param document A document with a table.
     * @returns An array of schema items.
     * @example
     * // schema: id,*name
     * ['id', '*name']
     */
    public static getTableSchema(document: vscode.TextDocument): string[] | undefined {
        for (let index = 0; index < document.lineCount; index++) {
            const line = document.lineAt(index);
            const schemaIndex = line.text.indexOf('schema:');
            if (schemaIndex !== -1) {
                return line.text.substring(schemaIndex + 'schema:'.length).split(',').map(x => x.trim());
            }
        }
    }
}