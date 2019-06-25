/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { isEmptyOrComment } from '../parser';
import { TextDocument } from "vscode";

export interface QuestTableEntry {
    readonly value: string;
    readonly text: string;
    readonly range: vscode.Range;
}

export class QuestTable {

    /**
     * All the entries in this table. If `hasQuests` is true, value is the name of a quest file.
     */
    public readonly content: QuestTableEntry[] = [];

    /**
     * Checks if this table provide quest names; otherwise it contains other data used by quests.
     */
    public get hasQuests(): boolean {
        return /QuestList-(.)+\.txt$/.test(this.fileName);
    }

    /**
     * Makes a quest table.
     * @param fileName The name of the file on disk.
     * @param schema A regular expression that must matches all entries.
     */
    private constructor(public readonly fileName: string, public readonly schema: RegExp) {
    }

    /**
     * Gets the uri to a quest referenced by an entry.
     * A quest table lists file names of quests within the same folder.
     * @param entry An entry of this quest table.
     */
    public makeQuestUri(entry: QuestTableEntry): vscode.Uri {
        return vscode.Uri.file(`${path.join(path.dirname(this.fileName), entry.value)}.txt`);
    }

    /**
     * Checks if the given uri corresponds to a quests table.
     * @param uri A document uri.
     */
    public static isTable(uri: vscode.Uri): boolean {
        return /Quest(s|List)-[^\.]+\.txt$/.test(uri.fsPath);
    }

    /**
     * Attempts to parse a quest table.
     * @param line A document which is expected to contain a quest table..
     * @returns A `QuestTable` instance if parse operation was successful, `undefined` otherwise.
     */
    public static parse(document: TextDocument): QuestTable | undefined {
        let table: QuestTable | undefined = undefined;

        for (let index = 0; index < document.lineCount; index++) {
            const line = document.lineAt(index);
            
            if (isEmptyOrComment(line.text)) {
                continue;
            }

            if (table === undefined) {
                if (/^\s*schema:/.test(line.text)) {
                    const args = line.text.split(',').length;
                    if (args > 0) {
                        const schema = new RegExp('^\s*[^,]*(,[^,]*){' + (args - 1) + '}$');
                        table = new QuestTable(document.fileName, schema);
                    }
                }
            } else {
                const matches = line.text.match(/^\s*([^,]+),/);
                if (matches !== null) {
                    table.content.push({
                        value: matches[1],
                        text: line.text,
                        range: line.range
                    });
                }
            }
        }

        return table;
    }
}