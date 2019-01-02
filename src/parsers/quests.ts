/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from './parser';
import { TextDocument, Location, Position } from "vscode";

const questDefinitionPattern = /^\s*Quest:\s+([a-zA-Z0-9_]+)/;
const questInvocationPattern = /^\s*start\s+quest\s+([a-zA-Z0-9_]+)/;
const questReferencePattern = /^\s*(Quest:|start\s+quest)\s+[a-zA-Z0-9_]+/;
export const displayNamePattern = /^\s*DisplayName:\s(.*)$/;

interface Quest {
    pattern: string;
    displayName: string;
    location: Location;
}

export function isQuestDefinition(line: string) {
    return questDefinitionPattern.test(line);
}

export function isQuestInvocation(line: string) {
    return questInvocationPattern.test(line);
}

export function isQuestReference(line: string) {
    return questReferencePattern.test(line);
}

/**
 * Finds the quest name of the given quest.
 * @param document A quest document.
 */
export function findQuestName(document: TextDocument): string {
    for (const displayName of parser.matchAllLines(document, questDefinitionPattern)) {
        return displayName.symbol;
    }

    return '';
}

/**
 * Finds the display name of the given quest.
 * @param document A quest document.
 */
export function findDisplayName(document: TextDocument): string {
    for (const displayName of parser.matchAllLines(document, displayNamePattern)) {
        return displayName.symbol;
    }

    return '';
}

/**
 * Find quest definition.
 * @param name Name pattern or index of quest.
 */
export function findQuestDefinition(name: string, token?: vscode.CancellationToken): Promise<Quest> {
    const questName = !isNaN(Number(name)) ? questIndexToName(name) : name;
    return new Promise((resolve, reject) => {
        return parser.findAllQuests(token).then((quests) => {
            const quest = quests.find((quest) => quest.pattern === questName);
            return quest ? resolve(quest) : reject();
        }, () => reject());
    });
}

/**
 * Finds all references to a quest in all files.
 * @param questName Name pattern of quest.
 */
export function findQuestReferences(questName: string, token?: vscode.CancellationToken): Thenable<Location[]> {

    /**
     * Finds references to S000nnnn family quest from its index.
     */
    function findIndexReferences(): Thenable<Location[]> {
        const index = questNameToIndex(questName);
        const indexPattern = index + ' ' + index;
        return index ? parser.findLinesInAllQuests(new RegExp('start quest ' + indexPattern), false, token).then(results =>
            results.map(x => {
                const char = x.line.text.indexOf(indexPattern);
                return new Location(x.document.uri, new vscode.Range(x.line.lineNumber, char, x.line.lineNumber, char + indexPattern.length));
            })) : Promise.resolve([]);
    }

    // Find references by name and index and merge the results.
    return Promise.all([
        parser.findReferences(questName, questReferencePattern, token),
        findIndexReferences()
    ]).then(locations => locations[0].concat(locations[1]));
}

/**
 * Finds all quests in the workspace.
 */
export function findAllQuests(token?: vscode.CancellationToken): Thenable<Quest[]> {
    return parser.findLinesInAllQuests(questDefinitionPattern, true, token).then(results => {
        return results.reduce((quests, result) => {
            const match = questDefinitionPattern.exec(result.line.text);
            if (match) {
                quests.push({ 
                    pattern: match[1], 
                    displayName: findDisplayName(result.document),
                    location: new Location(result.document.uri, new Position(result.line.lineNumber, 0))
                });
            }
            return quests;
        }, new Array<Quest>());
    }, () => []);
}

/**
 * Gets the name of a S000nnnn family quest from its index.
 */
export function questIndexToName(index: string): string {
    return 'S' + '0'.repeat(7 - index.length) + index;
}

/**
 * Gets the index of a S000nnnn family quest from its name.
 */
export function questNameToIndex(name: string): string | undefined {
    const match = name.match(/S0+([^0]+[0-9]*)/);
    if (match) {
        return match[1];
    }
}
