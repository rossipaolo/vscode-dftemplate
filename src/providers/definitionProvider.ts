/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Position, Definition } from 'vscode';
import { SymbolType } from '../language/static/common';
import { Quests } from '../language/quests';
import { LanguageData } from '../language/static/languageData';

export class TemplateDefinitionProvider implements vscode.DefinitionProvider {

    public constructor(private readonly quests: Quests, private readonly data: LanguageData) {
    }

    public async provideDefinition(document: TextDocument, position: Position, token: vscode.CancellationToken): Promise<Definition | undefined> {
        if (Quests.isTable(document.uri)) {
            const quest = await this.quests.findFromTable(document, position, token);
            if (quest !== undefined) {
                return quest.getNameLocation();
            }

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
                    const targetQuest = await this.quests.find(resource.value);
                    if (targetQuest) {
                        return targetQuest.getNameLocation();
                    }
                case 'type':
                    return this.data.questEngine.findSymbolType(resource.value);
                case 'action':
                    const name = resource.value.info.details.sourceName;
                    if (name !== undefined && name !== null) {
                        return this.data.questEngine.findAction(name);
                    }
                    break;
            }
        }
    }
}