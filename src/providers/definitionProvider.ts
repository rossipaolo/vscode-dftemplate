/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Position, Definition } from 'vscode';
import { SymbolType } from '../language/static/common';
import { Quests } from '../language/quests';
import { Quest } from '../language/quest';

export class TemplateDefinitionProvider implements vscode.DefinitionProvider {

    public constructor(private readonly quests: Quests) {
    }

    public async provideDefinition(document: TextDocument, position: Position, token: vscode.CancellationToken): Promise<Definition | undefined> {
        if (Quest.isTable(document.uri)) {
            return undefined;
        }

        const quest = this.quests.get(document);
        const resource = quest.getResource(position);
        if (resource) {
            switch (resource.kind) {
                case 'message':
                case 'task':
                    return quest.getLocation(resource.value.range);
                case 'symbol':
                    const symbol = resource.value;

                    // Clocks are defined as a symbol for QRC substitution and a task for firing.
                    if (symbol.type === SymbolType.Clock) {
                        const clockTask = quest.qbn.getTask(symbol.name);
                        if (clockTask) {
                            return [quest.getLocation(symbol.range), quest.getLocation(clockTask.range)];
                        }
                    }

                    return quest.getLocation(symbol.range);
                case 'quest':
                    const quests = await this.quests.getAll(token);
                    const questName = Quest.indexToName(resource.value);
                    const found = quests.find(x => x.getName() === questName);
                    if (found) {
                        return found.getNameLocation();
                    }
            }
        }
    }
}