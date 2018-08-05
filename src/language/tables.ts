/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

import { getOptions } from '../extension';

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

    protected set(data: string[][]) {
        data.forEach((place) => {
            this.getPlaceGroup(place[3]).push(place[0]);
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

export class Tables {
    private static instance: Tables | null;

    public readonly diseasesTable = new DiseasesTable();
    public readonly factionsTable = new FactionsTable();
    public readonly foesTable = new FoesTable();
    public readonly itemsTable = new ItemsTable();
    public readonly placesTable = new PlacesTable();
    public readonly soundsTable = new SoundsTable();

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
                instance.itemsTable.load(path.join(tablesPath, 'Quests-Items.txt')),
                instance.placesTable.load(path.join(tablesPath, 'Quests-Places.txt')),
                instance.soundsTable.load(path.join(tablesPath, 'Quests-Sounds.txt'))
            ]).then(() => resolve(),
                (e) => reject(e));
        });
    }

    /**
     * Finds an array of values from its signature word.
     */
    public getValues(signatureWord: string): string[] | undefined {
        switch (signatureWord) {
            case '${d:disease}':
                return this.diseasesTable.diseases;
            case '${d:IndividualNPC}':
            case '${d:faction}':
                return this.factionsTable.factions;
            case '${d:factionType}':
                return this.factionsTable.factionTypes;
            case '${d:group}':
                return this.factionsTable.groups;
            case '${d:foe}':
                return this.foesTable.foes;
            case '${d:commonItem}':
                return this.itemsTable.commonItems;
            case '${d:artifactItem}':
                return this.itemsTable.artifacts;
            case '${d:localRemotePlace}':
                return this.placesTable.localRemoteLocations;
            case '${d:permanentPlace}':
                return this.placesTable.permanentLocations;
            case '${d:sound}':
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
        let tablesPath = getOptions()['tablesPath'];
        if (tablesPath) {
            return tablesPath;
        }

        if (vscode.workspace.workspaceFolders) {
            const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

            // From StreamingAssets/Quests to StreamingAssets/Tables
            if (rootPath.endsWith(path.join('StreamingAssets', 'Quests'))) {
                return path.resolve(rootPath, '../Tables');
            }

            // From StreamingAssets/QuestPacks/Author/Pack to StreamingAssets/Tables
            if (path.resolve(rootPath, '../../').endsWith(path.join('StreamingAssets', 'QuestPacks'))) {
                return path.resolve(rootPath, '../../../Tables');
            }
        }
    }
}