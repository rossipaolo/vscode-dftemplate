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
     * The name of the file on disk.
     */
    public readonly fileName: string;

    /**
     * Version of text document that was parsed.
     */
    public readonly version: number;

    /**
     * A regular expression that must matches all entries.
     */
    public readonly schema: RegExp | undefined = undefined;

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

    public constructor(document: TextDocument) {
        this.fileName = document.fileName;
        this.version = document.version;

        for (let index = 0; index < document.lineCount; index++) {
            const line = document.lineAt(index);

            if (isEmptyOrComment(line.text)) {
                continue;
            }

            if (this.schema === undefined) {
                if (/^\s*schema:/.test(line.text)) {
                    const args = line.text.split(',').length;
                    if (args > 0) {
                        this.schema = new RegExp('^\s*[^,]*(,[^,]*){' + (args - 1) + '}$');
                    }
                }
            } else {
                const matches = line.text.match(/^\s*([^,]+),/);
                if (matches !== null) {
                    this.content.push({
                        value: matches[1],
                        text: line.text,
                        range: line.range
                    });
                }
            }
        }
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
}