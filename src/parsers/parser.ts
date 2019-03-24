/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Position, TextLine } from 'vscode';
import { TEMPLATE_LANGUAGE } from '../extension';

export * from './symbols';
export * from './messages';
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
 * Opens and gets all documents in the workspace which are assigned the Template language id.
 * @param token An optional cancellation token.
 */
export async function getAllDocuments(token?: vscode.CancellationToken): Promise<TextDocument[]> {
    const uris = await vscode.workspace.findFiles('**/*.txt', undefined, undefined, token);
    const documents = await Promise.all(uris.map(uri => vscode.workspace.openTextDocument(uri)));
    return documents.filter(document => document.languageId === TEMPLATE_LANGUAGE);
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

export function isQuestReference(line: string, name: string) {
    return new RegExp('^\\s*(Quest:|start\\s+quest)\\s+' + name).test(line);
}

/**
 * Gets the name of a S000nnnn family quest from its index.
 */
export function questIndexToName(index: string): string {
    return 'S' + '0'.repeat(7 - index.length) + index;
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