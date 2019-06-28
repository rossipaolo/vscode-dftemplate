/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Diagnostic } from 'vscode';
import { subRange } from '../parser';
import { QuestTable } from '../language/questTable';
import { Quests } from '../language/quests';
import { Errors } from './common';

export class TableLinter {
    public constructor(private readonly quests: Quests) {
    }

    public async analyse(document: vscode.TextDocument): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        const table = QuestTable.parse(document);
        if (table !== undefined && table.hasQuests && table.content.length > 0) {

            // Check entry against schema
            for (const entry of table.content) {
                if (!table.schema.test(entry.text)) {
                    diagnostics.push(Errors.schemaMismatch(entry.range));
                }
            }

            // Check if listed quest files exist
            if (table.hasQuests) {
                await Promise.all(table.content.map(async entry => {
                    if (!await this.quests.questExist(table.makeQuestUri(entry))) {
                        diagnostics.push(Errors.undefinedQuest(subRange(entry.range, entry.text, entry.value), entry.value));
                    }
                }));
            }
        }

        return diagnostics;
    }
}