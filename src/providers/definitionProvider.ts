/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { TextDocument, Position, Location } from 'vscode';
import { Quest } from '../language/quest';

export class TemplateDefinitionProvider implements vscode.DefinitionProvider {

    public provideDefinition(document: TextDocument, position: Position, token: vscode.CancellationToken): Thenable<Location> {
        return new Promise(resolve => {
            const word = parser.getWord(document, position);
            if (word) {

                if (parser.isQuestReference(document.lineAt(position.line).text, word)) {

                    // Quest
                    return Quest.getAll(token).then(quests => {
                        const questName = Quest.indexToName(word);
                        const found = quests.find(x => x.getName() === questName);
                        return resolve(found ? found.getNameLocation() : undefined);
                    });
                } else {

                    const quest = Quest.get(document);

                    // Symbol
                    const symbol = quest.qbn.getSymbol(word);
                    if (symbol) {
                        return resolve(quest.getLocation(symbol.range));
                    }

                    // Task
                    const task = quest.qbn.getTask(word);
                    if (task) {
                        return resolve(quest.getLocation(task.range));
                    }

                    // Message
                    const id = Number(word);
                    const message = quest.qrc.messages.find(x => x.id === id || x.alias === word);
                    if (message) {
                        return resolve(quest.getLocation(message.range));
                    }
                }
            }

            return resolve();
        });
    }
}