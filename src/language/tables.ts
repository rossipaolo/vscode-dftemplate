/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

import { getOptions, select, where } from '../extension';
import { ParameterTypes } from './parameterTypes';

abstract class Table {

    public load(path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const instance = this;
            vscode.workspace.openTextDocument(path).then((document) => {
                const table: string[][] = [];
                for (let index = 0; index < document.lineCount; index++) {
                    const line = document.lineAt(index).text;
                    if (!/^\s*((-|schema).*)?$/.test(line)) {
                        table.push(document.lineAt(index).text.split(',').map((w) => w.trim()));
                    }
                }
                instance.set(table);
                return resolve();
            }, (e) => reject(e));
        });
    }

    protected abstract set(data: string[][]): void;
}

class DiseasesTable extends Table {

    public readonly diseases: string[] = [];

    protected set(data: string[][]) {
        data.forEach((disease) => {
            this.diseases.push(disease[1]);
        });
    }
}

class FactionsTable extends Table {

    public readonly groups: string[] = [];
    public readonly factionTypes: string[] = [];
    public readonly factions: string[] = [];

    protected set(data: string[][]) {
        data.forEach((faction) => {
            if (faction[2] !== '?') {
                this.getFactionGroup(faction[2]).push(faction[0]);
            }
        });
    }

    private getFactionGroup(p2: string) {
        switch (p2) {
            case '-1':
                return this.factions;
            case '-2':
                return this.factionTypes;
            default:
                return this.groups;
        }
    }
}

class FoesTable extends Table {

    public readonly foes: string[] = [];

    protected set(data: string[][]) {
        data.forEach((foe) => {
            this.foes.push(foe[1]);
        });
    }
}

class GlobalVarsTable extends Table {

    public readonly globalVars = new Map<string, number>();

    protected set(data: string[][]) {
        data.forEach((globalVar) => {
            this.globalVars.set(globalVar[1], Number(globalVar[0]));
        });
    }
}

class ItemsTable extends Table {

    public readonly artifacts: string[] = [];
    public readonly commonItems: string[] = [];

    protected set(data: string[][]) {
        data.forEach((item) => {
            this.getItemGroup(item[1]).push(item[0]);
        });
    }

    private getItemGroup(p1: string) {
        switch (p1) {
            case '5':
                return this.artifacts;
            default:
                return this.commonItems;
        }
    }
}

class PlacesTable extends Table {

    public readonly permanentLocations: string[] = [];
    public readonly localRemoteLocations: string[] = [];
    public readonly locationTypes: string[] = [];

    protected set(data: string[][]) {
        data.forEach((place) => {
            this.getPlaceGroup(place[3]).push(place[0]);
            if (place[1] === '2' && place[3] === '0') {
                this.locationTypes.push(place[0]);
            }
        });
    }

    private getPlaceGroup(p3: string) {
        switch (p3) {
            case '-1':
                return this.permanentLocations;
            default:
                return this.localRemoteLocations;
        }
    }
}

class SoundsTable extends Table {

    public readonly sounds: string[] = [];

    protected set(data: string[][]) {
        data.forEach((sound) => {
            this.sounds.push(sound[1]);
        });
    }
}

class StaticMessagesTable extends Table {

    public readonly messages = new Map<string, number>();

    public *getAliases(id: number): Iterable<string> {
        yield* select(where(this.messages, item => item["1"] === id), item => item["0"]);
    }

    protected set(data: string[][]) {
        data.forEach(message => {
            if (message[0] !== '0') {
                this.messages.set(message[1], Number(message[0]));
            }
        });
    }
}

export class Tables {
    private static instance: Tables | null;

    public readonly diseasesTable = new DiseasesTable();
    public readonly factionsTable = new FactionsTable();
    public readonly foesTable = new FoesTable();
    public readonly globalVarsTable = new GlobalVarsTable();
    public readonly itemsTable = new ItemsTable();
    public readonly placesTable = new PlacesTable();
    public readonly soundsTable = new SoundsTable();
    public readonly staticMessagesTable = new StaticMessagesTable();

    private constructor() {
    }

    public load(): Promise<void> {
        const instance = this;
        return new Promise((resolve, reject) => {

            const tablesPath = Tables.getTablesPath();
            if (!tablesPath) {
                return reject('Tables path is not set!');
            }

            return Promise.all([
                instance.diseasesTable.load(path.join(tablesPath, 'Quests-Diseases.txt')),
                instance.factionsTable.load(path.join(tablesPath, 'Quests-Factions.txt')),
                instance.foesTable.load(path.join(tablesPath, 'Quests-Foes.txt')),
                instance.globalVarsTable.load(path.join(tablesPath, 'Quests-GlobalVars.txt')),
                instance.itemsTable.load(path.join(tablesPath, 'Quests-Items.txt')),
                instance.placesTable.load(path.join(tablesPath, 'Quests-Places.txt')),
                instance.soundsTable.load(path.join(tablesPath, 'Quests-Sounds.txt')),
                instance.staticMessagesTable.load(path.join(tablesPath, 'Quests-StaticMessages.txt'))
            ]).then(() => resolve(),
                (e) => reject(e));
        });
    }

    /**
     * Finds an array of values from its signature word.
     */
    public getValues(signatureWord: string): string[] | undefined {
        switch (signatureWord) {
            case ParameterTypes.disease:
                return this.diseasesTable.diseases;
            case ParameterTypes.faction:
                return this.factionsTable.factions;
            case ParameterTypes.factionType:
                return this.factionsTable.factionTypes;
            case ParameterTypes.group:
                return this.factionsTable.groups;
            case ParameterTypes.group:
                return this.foesTable.foes;
            case ParameterTypes.commonItem:
                return this.itemsTable.commonItems;
            case ParameterTypes.artifactItem:
                return this.itemsTable.artifacts;
            case ParameterTypes.localRemotePlace:
                return this.placesTable.localRemoteLocations;
            case ParameterTypes.permanentPlace:
                return this.placesTable.permanentLocations;
            case ParameterTypes.locationType:
                return this.placesTable.locationTypes;
            case ParameterTypes.sound:
                return this.soundsTable.sounds;
        }
    }

    public static getInstance(): Tables {
        return this.instance || (this.instance = new Tables());
    }

    public static release() {
        this.instance = null;
    }

    private static getTablesPath(): string | undefined {

        // Path from settings
        const tablesPath = getOptions()['tablesPath'];
        if (tablesPath) {

            if (path.isAbsolute(tablesPath)) {
                return tablesPath;
            }

            if (vscode.workspace.workspaceFolders) {
                return path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, tablesPath);
            }
        }
        else {

            // From subfolder of 'StreamingAssets' to 'StreamingAssets/Tables'
            const rootPath = Tables.getRootPath();
            if (rootPath) {
                const i = rootPath.lastIndexOf('StreamingAssets');
                if (i !== -1) {
                    return path.resolve(rootPath.substring(0, i), path.join('StreamingAssets', 'Tables'));
                }
            }
        }
        
    }

    private static getRootPath(): string | undefined {
        if (vscode.workspace.workspaceFolders) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        if (vscode.window.activeTextEditor) {
            return vscode.window.activeTextEditor.document.uri.fsPath;
        }
    }
}