/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as util from 'util';
import { Quest } from './quest';
import { first } from '../extension';
import { readTextFile, SymbolType } from './static/common';
import { CategorizedQuestResource } from './common';

class SaveInspectorItem extends vscode.TreeItem {
    public readonly iconPath = new vscode.ThemeIcon('file');

    public constructor(questName: string, displayName?: string | null) {
        super(questName);

        if (displayName) {
            this.description = displayName;
        }

        this.command = {
            title: "Show quest",
            command: 'dftemplate.showQuestWithName',
            arguments: [questName]
        };
    }
}

class SaveInspectorDataProvider implements vscode.TreeDataProvider<SaveInspectorItem> {

    private readonly _onDidChangeTreeData: vscode.EventEmitter<SaveInspectorItem | undefined | null> = new vscode.EventEmitter<SaveInspectorItem | undefined | null>();
    public readonly onDidChangeTreeData: vscode.Event<SaveInspectorItem | undefined | null> = this._onDidChangeTreeData.event;

    private _saveData: any;
    public set saveData(value: any) {
        this._saveData = value;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: SaveInspectorItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public getChildren(element?: SaveInspectorItem | undefined): vscode.ProviderResult<SaveInspectorItem[]> {
        const saveData = this._saveData;
        if (saveData && element === undefined) {
            const questsData: any[] = saveData.quests;
            if (questsData) {
                return questsData.map(x => new SaveInspectorItem(x.questName ?? '<quest>', x.displayName));
            }
        }
    }
}

export class SaveInspector {

    private readonly treeView: SaveInspectorDataProvider;
    private readonly markdownStrings = new Map<number, vscode.MarkdownString>();

    private readonly enabledTasksDecoration = SaveInspector.createDecorationType('dftemplate.saveInspector.background.enabled');
    private readonly disabledTaskDecoration = SaveInspector.createDecorationType('dftemplate.saveInspector.background.disabled');
    private readonly finishedTaskDecoration = SaveInspector.createDecorationType('dftemplate.saveInspector.background.finished');

    private uri: vscode.Uri | undefined;
    private saveData: any;
    private activeTextEditor: vscode.TextEditor | undefined;
    private currentQuest: Quest | undefined;

    private _isSetup: boolean = false;
    public get isSetup(): boolean {
        return this._isSetup;
    }
    
    public constructor(subscriptions: vscode.Disposable[]) {
        const treeView = new SaveInspectorDataProvider();
        subscriptions.push(vscode.window.registerTreeDataProvider('dftemplate.saveInspector', this.treeView = treeView));
        vscode.commands.executeCommand('setContext', 'dftemplate:saveInspectorIsEnabled', true);
    }

    /**
     * Shows an open dialog and load save data from disk.
     */
    public async setup(textEditor?: vscode.TextEditor, quest?: Quest) {
        this.activeTextEditor = textEditor;
        this.currentQuest = quest;

        const results = await vscode.window.showOpenDialog({
            openLabel: 'Select QuestData.txt',
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Json': ['txt', 'json'] }
        });

        if (results !== undefined && results.length === 1) {
            this.uri = results[0];
            this.reload();
        }
    }

    /**
     * Reloads save data from disk.
     */
    public async reload() {
        this.markdownStrings.clear();

        if (this.uri !== undefined) {
            const data = JSON.parse(await readTextFile(this.uri.fsPath));
            if (data !== undefined && data.quests !== undefined) {
                if ((data.quests as any[]).length > 0) {
                    this.saveData = data;
                    this.treeView.saveData = data;
                    this.updateDecorations();
                    this.setIsSetup(true);
                } else {
                    this.setIsSetup(false);
                    this.clearDecorations();
                    vscode.window.showInformationMessage('Serialized quest data is empty.');
                }
                
                return;
            }
        }

        this.setIsSetup(false);
        this.clearDecorations();
        vscode.window.showErrorMessage('Failed to load serialized data from file.');
    }

    /**
     * Updates decorations for a new active text editor.
     */
    public refresh(textEditor: vscode.TextEditor, quest: Quest | undefined) {
        this.markdownStrings.clear();
        this.clearDecorations();

        this.activeTextEditor = textEditor;
        this.currentQuest = quest;

        if (quest !== undefined) {
            this.updateDecorations();
        }
    }

    /**
     * Unloads save data.
     */
    public tearDown() {
        this.setIsSetup(false);
        this.saveData = undefined;
        this.treeView.saveData = undefined;
        this.markdownStrings.clear();
        this.clearDecorations();
    }

    /**
     * Finds the serialized object for a quest resource and makes a string representation.
     * The stringifieed object doesn't include children if they are also resources.
     * For example a task representation doesn't include the list of actions.
     * @param quest Target quest.
     * @param position A position inside the quest.
     * @returns A markdown codeblock or undefined.
     */
    public inspect(quest: Quest, position: vscode.Position): vscode.MarkdownString | undefined {
        if (this.saveData === undefined) {
            throw new Error('Can\'t inspect save data because is undefined.');
        }

        const resource = quest.getResource(position);
        if (resource !== undefined) {

            const key = this.getResourceKey(resource, quest.name);
            if (key === undefined) {
                return;
            }

            let markdown = this.markdownStrings.get(key);
            if (markdown !== undefined) {
                return markdown;
            }

            let data: any | undefined;

            try {
                const questsData: any[] = this.saveData.quests;
                const questData = questsData.find(x => x.questName === quest.name);
                if (questData !== undefined) {
                    let taskData: any;
                    switch (resource.kind) {
                        case 'quest':
                            data = Object.assign({}, questData);
                            delete data.messages;
                            delete data.resources;
                            delete data.tasks;
                            delete data.$version;
                            break;
                        case 'symbol':
                            const resourcesData: any[] = questData.resources;
                            const resourceData = resourcesData.find(x => x.symbol.original === resource.value.name);
                            if (resourceData !== undefined) {
                                data = Object.assign({}, resourceData);
                                delete data.type;
                                delete data.symbol;
                                delete data.$version;
                                delete data.resourceSpecific.$version;
                                delete data.resourceSpecific.$type;

                                if (resource.value.type === SymbolType.Clock) {
                                    const clockTaskData = this.getTaskData(questData, resource.value.name);
                                    if (clockTaskData !== undefined) {
                                        data = [data, clockTaskData];
                                    }
                                }
                            }
                            break;
                        case 'task':
                            data = this.getTaskData(questData, resource.value.name);
                            break;
                        case 'action':
                            const task = first(quest.qbn.iterateTasks(), x => x.blockRange.contains(position));
                            if (task !== undefined) {
                                const tasksData: any[] = questData.tasks;
                                taskData = tasksData.find(x => x.symbol.original === task.name);
                            } else {
                                const tasksData: any[] = questData.tasks;
                                if (tasksData.length > 0 && !isNaN(parseInt(tasksData[0].symbol.original))) {
                                    taskData = tasksData[0];
                                }
                            }

                            if (taskData !== undefined) {
                                const actionsData: any[] = taskData.actions;
                                const actionData = actionsData.find(x => x.debugSource === resource.value.line.text.trim());
                                if (actionData !== undefined) {
                                    data = Object.assign({}, actionData);
                                    delete data.type;
                                    delete data.debugSource;
                                    delete data.$version;
                                    delete data.actionSpecific.$version;
                                    delete data.actionSpecific.$type;
                                }
                            }
                            break;
                    }
                }

                if (data !== undefined) {
                    markdown = new vscode.MarkdownString();
                    markdown.appendCodeblock(util.inspect(data, { compact: false, depth: 4 }), 'ts');
                    this.markdownStrings.set(key, markdown);
                    return markdown;
                }

            } catch (e) {
                vscode.window.showErrorMessage(e);
                return;
            }
        }
    }

    private setIsSetup(value: boolean) {
        vscode.commands.executeCommand('setContext', 'dftemplate:saveInspectorIsSetup', this._isSetup = value);
    }

    private getResourceKey(resource: CategorizedQuestResource, questName: string): number | undefined {
        if (typeof (resource.value) === 'object') {
            return resource.value.range.start.line;
        }

        if (resource.kind === 'quest' && resource.value === questName) {
            return -1;
        }
    }

    private getTaskData(questData: any, taskName: string) {
        const tasksData: any[] = questData.tasks;
        const taskData = tasksData.find(x => x.symbol.original === taskName);
        if (tasksData !== undefined) {
            const data = Object.assign({}, taskData);
            delete data.symbol;
            delete data.actions;
            delete data.$version;
            return data;
        }
    }

    private clearDecorations() {
        if (this.activeTextEditor !== undefined && vscode.window.visibleTextEditors.includes(this.activeTextEditor)) {
            this.activeTextEditor.setDecorations(this.enabledTasksDecoration, []);
            this.activeTextEditor.setDecorations(this.disabledTaskDecoration, []);
            this.activeTextEditor.setDecorations(this.finishedTaskDecoration, []);
        }
    }

    private updateDecorations() {
        if (this.activeTextEditor === undefined || this.currentQuest === undefined) {
            throw new Error('Can\'t update decoration because text editor or quest is undefined.');
        }

        const quest = this.currentQuest;
        if (quest !== undefined) {
            const questsData: any[] = this.saveData.quests;
            const questData = questsData.find(x => x.questName === quest.name);
            if (questData !== undefined) {
                const enabled: vscode.Range[] = [];
                const disabled: vscode.Range[] = [];
                const finished: vscode.Range[] = [];

                for (const taskData of questData.tasks) {
                    if (taskData && taskData.symbol && taskData.symbol.original) {
                        let ranges;
                        if (taskData.triggered === true) {
                            ranges = enabled;
                        } else if (taskData.triggered === false) {
                            ranges = disabled;
                        }

                        if (ranges !== undefined) {
                            const task = quest.qbn.getTask(taskData.symbol.original);
                            if (task !== undefined) {
                                ranges.push(task.range);
                            }
                        }
                    }
                }

                for (const resource of questData.resources) {
                    if (resource && resource.symbol && typeof (resource.type) === 'string' &&
                        (resource.type as string).endsWith('Clock') && resource.resourceSpecific) {
                        let ranges;
                        if (resource.resourceSpecific.clockFinished === true) {
                            ranges = finished;
                        } else if (resource.resourceSpecific.clockEnabled === true) {
                            ranges = enabled;
                        } else if (resource.resourceSpecific.clockEnabled === false) {
                            ranges = disabled;
                        }

                        if (ranges !== undefined) {
                            const symbol = quest.qbn.getSymbol(resource.symbol.original);
                            if (symbol !== undefined) {
                                ranges.push(symbol.range);
                            }
                        }
                    }
                }

                this.activeTextEditor.setDecorations(this.enabledTasksDecoration, enabled);
                this.activeTextEditor.setDecorations(this.disabledTaskDecoration, disabled);
                this.activeTextEditor.setDecorations(this.finishedTaskDecoration, finished);
            }
        }
    }

    private static createDecorationType(backGroundColorId: string): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor(backGroundColorId),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('dftemplate.saveInspector.border'),
        });
    }
}