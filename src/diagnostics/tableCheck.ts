/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { subRange } from '../parser';
import { Errors } from './common';
import { QuestTable } from '../language/questTable';
import { Diagnostic } from 'vscode';
import { Quests } from '../language/quests';

/**
 * Do diagnostics for a quest table.
 * @param document A document with table schema.
 */
export async function tableCheck(document: vscode.TextDocument, quests: Quests): Promise<Diagnostic[]> {
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
                if (!await quests.questExist(table.makeQuestUri(entry))) {
                    diagnostics.push(Errors.undefinedQuest(subRange(entry.range, entry.text, entry.value), entry.value));
                }
            }));
        }
    }

    return diagnostics;
}