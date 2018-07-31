/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parser';
import { TextDocument, Range, Location, Position } from "vscode";

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
 * Finds the display name of the given quest.
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
 * @param name Name pattern of quest.
 */
export function findQuestDefinition(name: string): Promise<Quest> {
    return new Promise((resolve, reject) => {
        return parser.findAllQuests().then((quests) => {
            const quest = quests.find((quest) => quest.pattern === name);
            return quest ? resolve(quest) : reject();
        }, () => reject());
    });
}

/**
 * Finds all references to a quest in all files.
 * @param questName Name pattern of quest.
 */
export function findQuestReferences(questName: string): Thenable<Location[]> {
    return parser.findLinesInAllQuests(questReferencePattern).then(results => {
        const ranges: Location[] = [];
        for (const result of results) {
            const index = result.line.text.indexOf(questName);
            if (index !== -1) {
                ranges.push(new Location(result.document.uri, new Range(result.line.lineNumber, index, result.line.lineNumber, index + questName.length)));
            }
        }
        return ranges;
    });
}

/**
 * Finds all quests in the workspace.
 */
export function findAllQuests(): Thenable<Quest[]> {
    return parser.findLinesInAllQuests(questDefinitionPattern, true).then(results => {
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
