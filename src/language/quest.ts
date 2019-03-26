/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { TEMPLATE_LANGUAGE } from '../extension';
import { Action } from './common';
import { Preamble } from './preamble';
import { Qbn } from './qbn';
import { Qrc } from './qrc';

enum QuestBlock {
    Preamble,
    QRC,
    QBN
}

export interface QuestParseContext {
    block: QuestBlock;
    currentMessageBlock?: parser.messages.MessageBlock;
    currentActionsBlock?: Action[];
}

/**
 * A quest that corresponds to a text file.
 */
export class Quest {
    
    private static readonly quests = new Map<string, Quest>();

    /**
     * The block that holds quest directives.
     */
    public readonly preamble = new Preamble();

    /**
     * The block that holds text messages usable by the quest.
     */
    public readonly qrc = new Qrc();
    
    /**
     * The block that holds quest resources definition and tasks.
     */
    public readonly qbn = new Qbn();

    private readonly version: number;

    private constructor(public readonly document: vscode.TextDocument) {

        const context: QuestParseContext = {
            block: QuestBlock.Preamble
        };
        this.preamble.start = 0;

        for (let index = 0; index < this.document.lineCount; index++) {
            const line = this.document.lineAt(index);
    
            // Skip comments and empty lines
            if (parser.isEmptyOrComment(line.text)) {
                continue;
            }

            // Parse blocks separated by QRC and QBN directives
            switch (context.block) {
                case QuestBlock.Preamble:
                    if (line.text.indexOf('QRC:') !== -1) {
                        context.block = QuestBlock.QRC;
                        this.preamble.end = (this.qrc.start = line.lineNumber) - 1;
                    } else {
                        this.preamble.parse(line);
                    }
                    break;
                case QuestBlock.QRC:
                    if (line.text.indexOf('QBN:') !== -1) {
                        context.block = QuestBlock.QBN;
                        this.qrc.end = (this.qbn.start = line.lineNumber) - 1;
                    } else {
                        this.qrc.parse(this.document, line, context);
                    }
                    break;
                case QuestBlock.QBN:
                    this.qbn.parse(line, context);
                    break;
            }
        }

        if (this.qbn.start) {
            this.qbn.end = this.document.lineCount - 1;
        }
        
        this.version = document.version;
    }

    /**
     * Gets the name of this quest.
     */
    public getName(): string | undefined {
        const nameDirective = this.preamble.questName;
        if (nameDirective && nameDirective.signature.length > 1) {
            return nameDirective.signature[1].value;
        }
    }

    /**
     * Validates and converts a range to a location for this quest.
     * @param range The range to convert; if omitted this is the range of the entire quest.
     */
    public getLocation(range?: vscode.Range): vscode.Location {
        range = range || new vscode.Range(0, 0, this.document.lineCount, 0);
        return new vscode.Location(this.document.uri, this.document.validateRange(range));
    }

    /**
     * Gets the location of the directive that declares this quest.
     */
    public getNameLocation(): vscode.Location {
        const directive = this.preamble.questName;
        const range = directive ? directive.getRange(1) : new vscode.Range(0, 0, 0, 0);
        return new vscode.Location(this.document.uri, this.document.validateRange(range));
    }

    /**
     * Gets a `Quest` instance for the given document.
     * @param document A text document with a quest to be parsed.
     */
    public static get(document: vscode.TextDocument): Quest {
        let quest = Quest.quests.get(document.uri.fsPath);
        if (!quest || document.version > quest.version) {
            Quest.quests.set(document.uri.fsPath, quest = new Quest(document));
        }

        return quest;
    }

    /**
     * Deletes the stored `Quest` instance associated to the given document.
     * @param document A document whose corresponding quest is to be deleted.
     */
    public static delete(document: vscode.TextDocument): void {
        if (Quest.quests.has(document.uri.fsPath)) {
            Quest.quests.delete(document.uri.fsPath);
        }
    }

    /**
     * Gets all quests in the current workspace.
     * @param token An optional cancellation token.
     */
    public static async getAll(token?: vscode.CancellationToken): Promise<Quest[]> {
        const uris = await vscode.workspace.findFiles('**/*.txt', undefined, undefined, token);
        const documents = await Promise.all(uris.map(uri => vscode.workspace.openTextDocument(uri)));
        const quests = documents.filter(document => document.languageId === TEMPLATE_LANGUAGE);
        return quests.map(document => Quest.get(document));
    }
}