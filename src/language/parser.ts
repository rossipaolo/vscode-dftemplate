/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';

import { TextDocument, Position, TextLine } from 'vscode';

export * from './parsers/symbols';
export * from './parsers/messages';
export * from './parsers/quests';
export * from './parsers/tasks';

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
 * Finds a comment above a definition and returns its content.
 * @param document A quest document.
 * @param definitionLine Line index of item whose summary is requested.
 */
export function makeSummary(document: TextDocument, definitionLine: number): string {
    const previousLine = document.lineAt(definitionLine - 1).text;
    return /^\s*-+/.test(previousLine) ? previousLine.replace(/^\s*-+/, '').trim() : '';
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
 * Find the first line that satisfy the filter predicate.
 */
export function firstLine(document: TextDocument, filter: (line: TextLine) => boolean): TextLine | undefined {
    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);
        if (filter(line)) {
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
export function findLinesInAllQuests(regex: RegExp, onePerDocument?: boolean): Thenable<{ document: TextDocument, line: vscode.TextLine }[]> {
    return openAllDocuments().then((documents) => {
        const lines: { document: TextDocument, line: vscode.TextLine }[] = [];
        for (const document of documents) {
            for (const line of findLines(document, regex)) {
                lines.push({ document: document, line: line });
                if (onePerDocument) {
                    break;
                }
            }
        }
        return lines;
    }, () => []);
}

/**
 * Matches the given regular expression with all lines.
 * @param document A quest document.
 * @param regex A regular expression with a single match.
 */
export function* matchAllLines(document: TextDocument, regex: RegExp): Iterable<{ line: TextLine, symbol: string }> {
    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);
        const matches = regex.exec(line.text);
        if (matches) { yield { line: line, symbol: matches[1] }; }
    }
}

/**
 * Open all documents in the workspace.
 */
function openAllDocuments(): Thenable<TextDocument[]> {
    return vscode.workspace.findFiles('*.{txt,dftemplate}').then((uris) => {
        const documents: TextDocument[] = [];
        for (const uri of uris) {
            vscode.workspace.openTextDocument(uri).then((document) => {
                documents.push(document);
            });
        }
        return documents;
    });
}

export function getQuestBlocksRanges(document: TextDocument): { qrc: vscode.Range, qbn: vscode.Range } {
    const qrc = findLine(document, /^\s*QRC:\s*$/);
    const qbn = findLine(document, /^\s*QBN:\s*$/);

    return {
        qrc: new vscode.Range(qrc ? qrc.lineNumber : 0, 0, qbn ? qbn.lineNumber - 1 : 0, 0),
        qbn: new vscode.Range(qbn ? qbn.lineNumber : 0, 0, document.lineCount, 0)
    };
}