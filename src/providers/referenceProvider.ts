/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { ReferenceProvider, TextDocument, Position, Location, CancellationToken } from 'vscode';
import { Modules } from '../language/static/modules';

export class TemplateReferenceProvider implements ReferenceProvider {

    private static queries = (document: TextDocument, word: string) => [
        {
            accept: () => parser.findSymbolDefinition(document, word) !== undefined,
            do: (includeDeclaration: boolean) => parser.findSymbolReferences(document, word, includeDeclaration)
        },
        {
            accept: () => parser.findTaskDefinition(document, word) !== undefined,
            do: (includeDeclaration: boolean) => parser.findTasksReferences(document, word, includeDeclaration)
        },
        {
            accept: () => parser.findMessageDefinition(document, word) !== undefined,
            do: (includeDeclaration: boolean) => parser.findMessageReferences(document, word, includeDeclaration)
        }
    ]

    public provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean }, token: CancellationToken): Thenable<Location[]> {
        return new Promise(function (resolve, reject) {
            const line = document.lineAt(position.line);
            const word = parser.getWord(document, position);
            if (word) {

                const query = TemplateReferenceProvider.queries(document, word).find(x => x.accept());
                if (query) {
                    const locations: Location[] = [];
                    for (const range of query.do(options.includeDeclaration)) {
                        locations.push(new Location(document.uri, range));
                    }
                    return resolve(locations);
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
                        return actionReference !== undefined && actionReference.details === actionResult.details;
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