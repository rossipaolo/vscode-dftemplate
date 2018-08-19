/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { ReferenceProvider, TextDocument, Position, Location, CancellationToken } from 'vscode';
import { Modules } from '../language/modules';

export class TemplateReferenceProvider implements ReferenceProvider {

    public provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean }, token: CancellationToken): Thenable<Location[]> {
        return new Promise(function (resolve, reject) {
            const line = document.lineAt(position.line);
            const word = parser.getWord(document, position);
            if (word) {

                // Symbol
                if (parser.findSymbolDefinition(document, word)) {
                    const locations: Location[] = [];
                    for (const range of parser.findSymbolReferences(document, word, options.includeDeclaration)) {
                        locations.push(new Location(document.uri, range));
                    }
                    return resolve(locations);
                }

                // Task
                if (parser.findTaskDefinition(document, word)) {
                    const locations: Location[] = [];
                    for (const range of parser.findTasksReferences(document, word, options.includeDeclaration)) {
                        locations.push(new Location(document.uri, range));
                    }
                    return resolve(locations);
                }

                // Message
                const messages = Array.from(parser.findMessageReferences(document, word, options.includeDeclaration));
                if (messages.length > 0) {
                    return resolve(messages.map(x => new Location(document.uri, x)));
                }
                
                // Quest
                if (parser.isQuestReference(line.text)) {
                    return parser.findQuestReferences(word, token).then((locations) => resolve(locations), () => reject());
                }

                // Action
                const actionResult = Modules.getInstance().findAction(line.text);
                if (actionResult && Modules.isActionName(actionResult, word)) {
                    const locations: Location[] = [];
                    for (const line of parser.filterLines(document, line => {
                        const actionReference = Modules.getInstance().findAction(line.text);
                        return actionReference !== undefined && actionReference.action === actionResult.action;
                    })) {
                        locations.push(new Location(document.uri, parser.trimRange(line)));
                    }
                    return resolve(locations);
                }

                // Global variables
                return parser.findGlobalVarsReferences(word, token).then((locations) => resolve(locations), () => reject());
            }

            return reject();
        });
    }
}