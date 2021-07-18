/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { getOptions, select, where } from '../../extension';
import { readTextFileLines, findWorkspaceSubFolder } from './common';
import { ParameterTypes } from './parameterTypes';

/**
 * Parses the content of a csv table from text lines.
 * The table can have a schema (`schema: *`) and comments (`-- *`).
 * @param textLines Lines of text.
 * @returns Entries of csv table.
 */
export function parseCsvTable(textLines: readonly string[]): string[][] {
    return textLines.reduce((content, textLine) => {
        if (!/^\s*((-|schema).*)?$/.test(textLine)) {
            content.push(textLine.split(',').map(w => w.trim()));
        }
        return content;
    }, [] as string[][]);
}

abstract class Table {
    public abstract set(data: readonly string[][]): void;
}

class DiseasesTable extends Table {

    public readonly diseases: string[] = [];

    public set(data: readonly string[][]) {
        data.forEach((disease) => {
            this.diseases.push(disease[1]);
        });
    }
}

class FactionsTable extends Table {

    public readonly groups: string[] = [];
    public readonly factionTypes: string[] = [];
    public readonly factions: string[] = [];

    public set(data: readonly string[][]) {
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

    public set(data: readonly string[][]) {
        data.forEach((foe) => {
            this.foes.push(foe[1]);
        });
    }
}

class GlobalVarsTable extends Table {

    public readonly globalVars = new Map<string, number>();

    public set(data: readonly string[][]) {
        data.forEach((globalVar) => {
            this.globalVars.set(globalVar[1], Number(globalVar[0]));
        });
    }
}

class ItemsTable extends Table {

    public readonly artifacts: string[] = [];
    public readonly commonItems: string[] = [];

    public set(data: readonly string[][]) {
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

    public set(data: readonly string[][]) {
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

    public set(data: readonly string[][]) {
        data.forEach((sound) => {
            this.sounds.push(sound[1]);
        });
    }
}

class SpellsTable extends Table {

    public readonly spells: string[] = [];

    public set(data: readonly string[][]) {
        data.forEach(spell =>
            this.spells.push(spell[1]));
    }
}

class StaticMessagesTable extends Table {

    public readonly messages = new Map<string, number>();

    public *getAliases(id: number): Iterable<string> {
        yield* select(where(this.messages, item => item["1"] === id), item => item["0"]);
    }

    public set(data: readonly string[][]) {
        data.forEach(message => {
            if (message[0] !== '0') {
                this.messages.set(message[1], Number(message[0]));
            }
        });
    }
}

class SpellsEntityTable extends Table {

    public readonly attributes: string[] = [];
    public readonly skills: string[] = [];

    public set(data: readonly string[][]) {
        data.forEach(entry => {
            switch (entry[1]) {
                case '0':
                    this.attributes.push(entry[0]);
                    break;
                case '1':
                    this.skills.push(entry[0]);
                    break;
            }
        });
    }
}

/**
 * Loader of csv tables.
 */
export class TableLoader {
    private tablesPath: Promise<string | undefined> | undefined;

    /**
     * Loads a csv table from its name.
     * @param table Table.
     * @param tableName Name of csv file with table content.
     */
    public async loadTable<T extends Table>(table: T, tableName: string): Promise<void> {
        if (this.tablesPath === undefined) {
            this.tablesPath = this.getTablesPath();
        }

        const tablesPath = await this.tablesPath;
        if (tablesPath === undefined) {
            return Promise.reject('Tables path is not set!');
        }

        table.set(parseCsvTable(await readTextFileLines(path.join(tablesPath, tableName))));
    }

    /**
     * Gets the path to _StreamingAssets/Tables_. It can be obtained in three ways:
     * 1. From settings.
     * 2. From relative path if workspace is inside _StreamingAssets_ or includes it.
     * 3. With an open dialog request; the selected folder is written to user settings.
     */
    private async getTablesPath(): Promise<string | undefined> {

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
            const getRootPath = () => {
                if (vscode.workspace.workspaceFolders) {
                    return vscode.workspace.workspaceFolders[0].uri.fsPath;
                }

                if (vscode.window.activeTextEditor) {
                    return vscode.window.activeTextEditor.document.uri.fsPath;
                }
            };
            const rootPath = getRootPath();
            if (rootPath) {
                const i = rootPath.lastIndexOf('StreamingAssets');
                if (i !== -1) {
                    return path.resolve(rootPath.substring(0, i), path.join('StreamingAssets', 'Tables'));
                }
            }

            // Check if Daggerfall Unity is part of current workspace
            const workspaceSubFolder = await findWorkspaceSubFolder('Assets/StreamingAssets/Tables/');
            if (workspaceSubFolder !== undefined) {
                return workspaceSubFolder;
            }

            // Ask with open folder dialog
            const item = await vscode.window.showErrorMessage('Path to StreamingAssets/Tables is not set!', 'Select folder');
            if (item) {
                const uri = await vscode.window.showOpenDialog({ canSelectFolders: true });
                if (uri) {
                    const fsPath = uri[0].fsPath;
                    await getOptions().update('tablesPath', fsPath, true);
                    return fsPath;
                }
            }
        }
    }
}

export class Tables {
    public readonly diseasesTable = new DiseasesTable();
    public readonly factionsTable = new FactionsTable();
    public readonly foesTable = new FoesTable();
    public readonly globalVarsTable = new GlobalVarsTable();
    public readonly itemsTable = new ItemsTable();
    public readonly placesTable = new PlacesTable();
    public readonly soundsTable = new SoundsTable();
    public readonly spellsTable = new SpellsTable();
    public readonly staticMessagesTable = new StaticMessagesTable();
    public readonly spellsEntityTable = new SpellsEntityTable();

    public async load(tableLoader: TableLoader): Promise<void> {
        await Promise.all([
            tableLoader.loadTable(this.diseasesTable, 'Quests-Diseases.txt'),
            tableLoader.loadTable(this.factionsTable, 'Quests-Factions.txt'),
            tableLoader.loadTable(this.foesTable, 'Quests-Foes.txt'),
            tableLoader.loadTable(this.globalVarsTable, 'Quests-GlobalVars.txt'),
            tableLoader.loadTable(this.itemsTable, 'Quests-Items.txt'),
            tableLoader.loadTable(this.placesTable, 'Quests-Places.txt'),
            tableLoader.loadTable(this.soundsTable, 'Quests-Sounds.txt'),
            tableLoader.loadTable(this.spellsTable, 'Quests-Spells.txt'),
            tableLoader.loadTable(this.staticMessagesTable, 'Quests-StaticMessages.txt'),
            tableLoader.loadTable(this.spellsEntityTable, 'Spells-Entity.txt')
        ]);
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
            case ParameterTypes.foe:
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
            case ParameterTypes.spell:
                return this.spellsTable.spells;
            case ParameterTypes.attributeName:
                return this.spellsEntityTable.attributes;
            case ParameterTypes.skillName:
                return this.spellsEntityTable.skills;
            case ParameterTypes.season:
                return ['summer', 'fall', 'winter', 'spring'];
            case ParameterTypes.weather:
                return ['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow'];
            case ParameterTypes.climate:
                return ['desert', 'desert2', 'mountain', 'mountainwoods', 'rainforest', 'ocean', 'swamp', 'subtropical', 'woodlands', 'hauntedwoodlands'];
            case ParameterTypes.baseClimate:
                return ['desert', 'mountain', 'temperate', 'swamp'];
        }
    }
}