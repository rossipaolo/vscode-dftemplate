/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextLine, Range, MarkdownString, Position } from 'vscode';
import { EOL } from 'os';
import { TEMPLATE_LANGUAGE, first } from '../extension';
import { ParameterTypes } from './static/parameterTypes';
import { QuestParseContext, QuestBlockKind, QuestResource, CategorizedQuestResource } from './common';
import { Preamble } from './preamble';
import { Qbn } from './qbn';
import { Qrc } from './qrc';

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

    /**
     * Ranges of comment blocks, composed of one or more consecutive lines.
     */
    public readonly comments: Range[] = [];

    private readonly version: number;

    private constructor(public readonly document: vscode.TextDocument) {

        const context: QuestParseContext = {
            document: document,
            block: this.preamble,
            blockStart: 0
        };

        for (let index = 0; index < this.document.lineCount; index++) {
            const line = this.document.lineAt(index);

            // Skip empty lines
            if (/^\s*$/.test(line.text)) {
                continue;
            }

            // Store comments
            if (/^\s*-/.test(line.text)) {
                this.addComment(line);
                continue;
            }

            // Parse blocks separated by QRC and QBN directives
            if (context.block.kind === QuestBlockKind.Preamble && line.text.indexOf('QRC:') !== -1) {
                context.block.setRange(document, 0, (context.blockStart = line.lineNumber) - 1);
                context.block = this.qrc;
            } else if (context.block.kind === QuestBlockKind.QRC && line.text.indexOf('QBN:') !== -1) {
                context.block.setRange(document, context.blockStart, (context.blockStart = line.lineNumber) - 1);
                context.block = this.qbn;
            } else {
                context.block.parse(line, context);
            }
        }

        context.block.setRange(document, context.blockStart, document.lineCount - 1);
        
        this.version = document.version;
    }

    /**
     * Gets the name of this quest.
     */
    public getName(): string | undefined {
        const directive = this.preamble.questName;
        if (directive) {
            return directive.parameter.value;
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
        const range = directive ? directive.valueRange : new vscode.Range(0, 0, 0, 0);
        return new vscode.Location(this.document.uri, this.document.validateRange(range));
    }

    /**
     * Gets the resource defined or referenced at the given position.
     * @param position A position inside this quest.
     * @returns A resource or the name of a static item.
     */
    public getResource(position: Position): CategorizedQuestResource | undefined {

        const range = this.document.getWordRangeAtPosition(position);
        if (range === undefined) {
            return undefined;
        }

        const word = this.document.getText(range);

        const isInside = <T extends QuestResource>(resource: T) => resource.blockRange.contains(position);

        if (this.preamble.range && this.preamble.range.contains(position)) {

            const directive = this.preamble.directives.find(isInside);
            if (directive !== undefined) {
                if (directive.range.contains(position)) {
                    return { kind: 'directive', value: directive.name };
                }
                else if (directive.name === 'Quest') {
                    return { kind: 'quest', value: word };
                }
            }
        } else if (this.qrc.range && this.qrc.range.contains(position)) {

            if (word === 'QRC' && position.line === this.qrc.range.start.line) {
                return { kind: 'directive', value: word };
            }

            const message = this.qrc.messages.find(isInside);
            if (message !== undefined) {
                if (message.range.contains(position) || (message.aliasRange !== undefined && message.aliasRange.contains(position))) {
                    return { kind: 'message', value: message };
                } else if (word.startsWith('%')) {
                    const macro = this.qrc.macros.find(x => x.range.contains(position));
                    if (macro !== undefined) {
                        return { kind: 'macro', value: macro.symbol };
                    }
                } else {
                    const symbol = this.qbn.getSymbol(word);
                    if (symbol !== undefined) {
                        return { kind: 'symbol', value: symbol, variation: word };
                    }
                }
            }
        } else if (this.qbn.range && this.qbn.range.contains(position)) {

            if (word === 'QBN' && position.line === this.qbn.range.start.line) {
                return { kind: 'directive', value: word };
            }

            for (const symbol of this.qbn.iterateSymbols()) {
                if (symbol.name === word) {
                    return { kind: 'symbol', value: symbol };
                } else if (symbol.type === word) {
                    return { kind: 'type', value: symbol.type };
                }
            }

            for (const task of this.qbn.iterateTasks()) {
                if (task.name === word) {
                    return { kind: 'task', value: task };
                } else if (task.definition.globalVarName === word) {
                    return { kind: 'globalVar', value: word };
                }
            }

            const action = first(this.qbn.iterateActions(), isInside);
            if (action) {
                if (action.range.contains(position)) {
                    return { kind: 'action', value: action };
                } else {

                    const message = this.qrc.getMessage(word);
                    if (message) {
                        return { kind: 'message', value: message };
                    }

                    for (let index = 0; index < action.signature.length; index++) {
                        const parameter = action.signature[index];
                        if (parameter.value === word &&
                            (parameter.type === ParameterTypes.questID || parameter.type === ParameterTypes.questName) &&
                            action.getRange(index).contains(position)) {
                            return { kind: 'quest', value: word };
                        }
                    }
                }
            }
        }
    }

    /**
     * Finds a comment block above the definition of a resource and returns its formatted content.
     * If necessary, the resulting documentation will be further processed for the specific resource type.
     * @param resource A resource defined in this quest or `undefined` for the quest itself.
     * @param markdown If `true`, returns a markdown string instead of a string.
     */
    public makeDocumentation(resource?: QuestResource, markdown?: false): string | undefined;
    public makeDocumentation(resource: QuestResource | undefined, markdown: true): MarkdownString | undefined;
    public makeDocumentation(resource: QuestResource | undefined, markdown: boolean | undefined): string | MarkdownString | undefined;
    public makeDocumentation(resource: QuestResource | undefined, markdown: boolean | undefined): string | MarkdownString | undefined {
        if (resource === undefined) {
            const directive = this.preamble.questName;
            return directive !== undefined ? this.makeDocumentation(directive, markdown) : undefined;
        }

        const result = (summary?: string) => {
            summary = resource.makeDocumentation ? resource.makeDocumentation(summary) : summary;
            return markdown ? new MarkdownString(summary) : summary;
        };

        const range = this.comments.find(x => x.end.line === resource.range.start.line - 1);
        if (range === undefined) {
            return result();
        }

        let summary: string = '';
        for (let index = range.start.line; index <= range.end.line; index++) {
            const line = this.document.lineAt(index);
            summary += /^\s*-+\s*$/.test(line.text) ? EOL.repeat(2) : line.text.replace(/^\s*-+/, '');
        }
        return result(summary.trim());
    }

    /**
     * Adds a comment to the previous comment block if is on a consecutive line, otherwise pushes a new comment block.
     * @param line A new line with a comment.
     */
    private addComment(line: TextLine): void {
        if (this.comments.length > 0 && line.lineNumber - this.comments[this.comments.length - 1].end.line === 1) {
            this.comments[this.comments.length - 1] = this.comments[this.comments.length - 1].union(line.range);
        } else {
            this.comments.push(line.range);
        }
    }

    /**
     * Registers to documents events.
     */
    public static initialize(): vscode.Disposable {
        const fsWatcher = vscode.workspace.createFileSystemWatcher('**/*.txt', true, true, false);
        fsWatcher.onDidDelete(uri => {
            if (Quest.quests.has(uri.fsPath)) {
                Quest.quests.delete(uri.fsPath);
            }
        });
        return fsWatcher;
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
     * Gets all quests in the current workspace.
     * @param token An optional cancellation token.
     */
    public static async getAll(token?: vscode.CancellationToken): Promise<Quest[]> {
        const quests: Quest[] = [];

        const uris = await vscode.workspace.findFiles('**/*.txt', undefined, undefined, token);
        for (const uri of uris.filter(x => !Quest.isTable(x))) {
            const quest = Quest.quests.get(uri.fsPath);
            if (quest) {
                quests.push(quest);
            } else {
                const document = await vscode.workspace.openTextDocument(uri);
                if (document && document.languageId === TEMPLATE_LANGUAGE) {
                    quests.push(Quest.get(document));
                }
            }
        }

        return quests;
    }

    /**
     * Gets the name of a S000nnnn family quest from its index.
     * @param idOrName Quest index or name.
     * @returns The quest name if `idOrName` is actually an index, otherwise the string as is.
     */
    public static indexToName(idOrName: string) {
        return !isNaN(Number(idOrName)) ? 'S' + '0'.repeat(7 - idOrName.length) + idOrName : idOrName;
    }
    
    /**
     * Checks if the given uri corresponds to a quests table.
     * @param uri A document uri.
     */
    public static isTable(uri: vscode.Uri): boolean {
        return /Quest(s|List)-[a-zA-Z]+\.txt$/.test(uri.fsPath);
    }
}