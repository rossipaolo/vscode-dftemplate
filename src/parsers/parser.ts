/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { TextDocument, Position, TextLine, Location } from 'vscode';
import { TEMPLATE_LANGUAGE } from '../extension';

export * from './symbols';
export * from './messages';
export * from './quests';
export * from './tasks';

/**
* Gets a word from the given position of a document.
* @param document A quest document.
* @param position The position in the document.
*/
export function getWord(document: TextDocument, position: Position): string | undefined {
    let range = document.getWordRangeAtPosition(position);
    if (range && !range.isEmpty) {
        return document.getText(range);
    }
}

/**
 * Gets the first word in a line.
 * @param text A line of text.
 */
export function getFirstWord(text: string): string | undefined {
    const match = /^\s*([a-zA-Z_\.']+)/.exec(text);
    if (match) {
        return match[1];
    }
}

/**
 * Gets the range of a word inside a line of text.
 * @param line A document line.
 * @param word A word inside `line`.
 */
export function rangeOf(line: TextLine, word: string) {
    const index = line.text.indexOf(word);
    return new vscode.Range(line.lineNumber, index, line.lineNumber, index + word.length);
}

/**
 * Checks if a line is empty or a comment.
 * @param text A line of a quest.
 */
export function isEmptyOrComment(text: string): boolean {
    return /^\s*(-.*)?\s*$/.test(text);
}

/**
 * Finds a comment block above a definition and returns its content.
 * @param document A quest document.
 * @param definitionLine Line index of item whose summary is requested.
 */
export function makeSummary(document: TextDocument, definitionLine: number): string {
    let summary: string = '';
    let text;
    while (/^\s*-+/.test(text = document.lineAt(--definitionLine).text)) {
        summary = text.replace(/^\s*-+\s*/, '') + ' ' + summary;
    }
    return summary.trim();
}

/**
 * Find the first line that matches the regular expression.
 */
export function findLine(document: TextDocument, regex: RegExp): TextLine | undefined {
    for (const line of findLines(document, regex)) {
        return line;
    }
}

/**
 * Find the first line that satisfy the filter predicate. Ignore empty lines and comments.
 */
export function firstLine(document: TextDocument, filter: (line: TextLine) => boolean): TextLine | undefined {
    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);
        if (!isEmptyOrComment(line.text) && filter(line)) {
            return line;
        }
    }
}

/**
 * Finds all lines that satisfy the filter predicate. Ignore empty lines and comments.
 */
export function* filterLines(document: TextDocument, filter: (line: TextLine) => boolean): Iterable<TextLine> {
    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);
        if (!isEmptyOrComment(line.text) && filter(line)) {
            yield line;
        }
    }
}

/**
 * Finds all lines tht match a regular expression.
 * @param document A quest document.
 * @param regex A regular expression matched on all lines.
 */
export function* findLines(document: TextDocument, regex: RegExp): Iterable<TextLine> {
    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        if (regex.test(line.text)) {
            yield line;
        }
    }
}

/**
 * Finds all lines that match a regular expression.
 * @param regex A regular expression matched on all lines.
 * @param onePerDocument Stops on first match for each document.
 */
export function findLinesInAllQuests(regex: RegExp, onePerDocument: boolean = false, token?: vscode.CancellationToken): Thenable<{ document: TextDocument, line: vscode.TextLine }[]> {
    const lines: { document: TextDocument, line: vscode.TextLine }[] = [];
    return openAllDocuments((document) => {
        for (const line of findLines(document, regex)) {
            lines.push({ document: document, line: line });
            if (onePerDocument) {
                break;
            }
        }
    }, token).then(() => lines, () => []);
}

/**
 * Matches the given regular expression with all lines.
 * @param document A quest document.
 * @param regex A regular expression with a single match.
 */
export function* matchAllLines(document: TextDocument, regex: RegExp, match: number = 1): Iterable<{ line: TextLine, symbol: string }> {
    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);
        const matches = regex.exec(line.text);
        if (matches) { yield { line: line, symbol: matches[match] }; }
    }
}

/**
 * Iterates all lines in a document which are not empty nor comments.
 */
export function* getCodeLines(document: TextDocument): Iterable<TextLine> {
    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);
        if (!isEmptyOrComment(line.text)) {
            yield line;
        }
    }
}

/**
 * Gets all matches with index in a string.
 * @param text A string.
 * @param regex A regular expression with global flag.
 */
export function* getMatches(text: string, regex: RegExp): Iterable<{ word: string, index: number }> {

    if (regex.flags.indexOf('g') === -1) {
        console.error('Regex has no global flag: ' + regex.toString());
        return;
    }

    let result: RegExpExecArray | null;
    while ((result = regex.exec(text)) !== null) {
        yield { word: result[0], index: result.index };
    }
}

/**
 * Finds references of a symbol in all files with a regular expression.
 * @param name Name of symbol.
 * @param regex A regular expression that matches the symbol references.
 */
export function findReferences(name: string, regex: RegExp, token?: vscode.CancellationToken): Thenable<Location[]> {
    return findLinesInAllQuests(regex, false, token).then(results => {
        return results.reduce((locations, result) => {
            const index = result.line.text.indexOf(name);
            if (index !== -1) {
                locations.push(new Location(result.document.uri, new vscode.Range(result.line.lineNumber, index, result.line.lineNumber, index + name.length)));
            }
            return locations;
        }, new Array<Location>());
    });
}

/**
 * Open all documents in the workspace.
 * @param callback A callback called for each document
 */
async function openAllDocuments(callback: (document: TextDocument) => void, token?: vscode.CancellationToken): Promise<void> {
    const uris = await vscode.workspace.findFiles('**/*.txt', undefined, undefined, token);
    await Promise.all(uris.map(uri => vscode.workspace.openTextDocument(uri).then(doc => {
        if (doc.languageId === TEMPLATE_LANGUAGE) {
            callback(doc);
        }
    })));
}

export function getQuestBlocksRanges(document: TextDocument): { qrc: vscode.Range, qbn: vscode.Range } {
    const qrc = findLine(document, /^\s*QRC:\s*$/);
    const qbn = findLine(document, /^\s*QBN:\s*$/);

    return {
        qrc: new vscode.Range(qrc ? qrc.lineNumber : 0, 0, qbn ? qbn.lineNumber - 1 : 0, 0),
        qbn: new vscode.Range(qbn ? qbn.lineNumber : 0, 0, document.lineCount, 0)
    };
}

/**
 * Checks if this document is a quest table.
 * @param document A text document.
 */
export function isQuestTable(document: vscode.TextDocument): boolean {
    return /Quest(s|List)-[a-zA-Z]+\.txt/.test(document.fileName);
}

export function trimRange(line: vscode.TextLine): vscode.Range {
    return new vscode.Range(line.lineNumber, line.firstNonWhitespaceCharacterIndex,
        line.lineNumber, line.text.replace(/\s+$/, '').length);
}