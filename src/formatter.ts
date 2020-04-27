/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from './parser';

import { Range, TextEdit, TextLine, TextDocument, FormattingOptions, Position } from 'vscode';
import { getOptions } from './extension';
import { Tables } from './language/static/tables';

interface FormatterResults {
    textEdit?: TextEdit;
    textEdits?: TextEdit[];
    formatNextLineRequest?: FormatLineRequest;
}

interface FormatLineRequest {
    requestLine: (line: TextLine) => boolean;
    formatLine: (line: TextLine) => FormatterResults | undefined;
}

type FormatterCallback = (line: TextLine) => FormatterResults | undefined;

/**
 * A formatter for Template quests and Daggerfall Unity tables.
 */
export class Formatter {

    private static readonly unaltered: FormatterResults = {};
    private static readonly keywordsFormat: { match: RegExp, wanted: RegExp, text: string }[] = [
        {
            match: /^\s*Messages\s*:\s*([0-9]+)\s*$/,
            wanted: /^Messages:\s[0-9]+$/,
            text: "Messages: $"
        },
        {
            match: /^\s*Quest\s*:\s*([A-Z0-9]+)\s*$/,
            wanted: /^Quest:\s[A-Z0-9]+$/,
            text: "Quest: $"
        },
        {
            match: /^\s*DisplayName:\s*([^\s].*[^\s])\s*$/,
            wanted: /^DisplayName:\s[^\s].*[^\s]+$/,
            text: "DisplayName: $"
        },
        {
            match: /^\s*(QRC|QBN)\s*:\s*$/,
            wanted: /^(QRC|QBN):$/,
            text: "$:"
        }
    ];

    private readonly document: TextDocument;
    private readonly indent: string;
    private readonly formatEmptyLines: boolean;

    /**
    * A new instance of a formatter for a Template document.
    * @param document The document to format.
    * @param options Formatting options.
    * @param formatEmptyLines Trim empty lines and keep a single one between blocks.
    * @param tables Language tables used for parsing.
    */
    public constructor(document: TextDocument, options: FormattingOptions, formatEmptyLines: boolean, private readonly tables: Tables) {
        this.document = document;
        this.indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
        this.formatEmptyLines = formatEmptyLines;
    }

    /**
     * Formats a range of a quest.
     * @param range The range to format.
     */
    public formatQuest(range: Range): TextEdit[] {
        const questBlocks = parser.getQuestBlocksRanges(this.document);
        const qrcRange = range.intersection(new Range(new Position(0, 0), questBlocks.qrc.end));
        const qbnRange = range.intersection(questBlocks.qbn);
        return [
            ...qrcRange ? this.doFormat(qrcRange, [
                (line) => this.formatEmptyOrComment(line),
                (line) => this.formatKeyword(line),
                (line) => this.formatMessage(line)
            ]) : [],
            ...qbnRange ? this.doFormat(qbnRange, [
                (line) => this.formatEmptyOrComment(line),
                (line) => this.formatKeyword(line),
                (line) => this.formatSymbolDefinition(line),
                (line) => this.formatHeadlessEntryPoint(line),
                (line) => this.formatTask(line)
            ]) : []
        ];
    }

    /**
     * Formats a range of a table.
     * @param range The range to format.
     */
    public formatTable(range: Range): TextEdit[] {
        return this.doFormat(range, [
            (line) => this.formatEmptyOrComment(line),
            (line) => this.formatTableSchema(line),
            (line) => this.formatTableEntry(line)
        ]);
    }

    /**
     * Formats a range of a document.
     * @param range The range to format.
     * @param formatters A list of formatters for this range.
     */
    private doFormat(range: Range, formatters: FormatterCallback[]): TextEdit[] {
        const textEdits: TextEdit[] = [];

        function pushTextEdits(results: FormatterResults) {
            if (results.textEdit) {
                textEdits.push(results.textEdit);
            }
            if (results.textEdits && results.textEdits.length > 0) {
                textEdits.push(...results.textEdits);
            }
        }
        
        let blockStartFound = false;
        for (let i = range.start.line; i <= range.end.line; i++) {
            
            // Do not start from an empty line
            if (blockStartFound || !this.document.lineAt(i).isEmptyOrWhitespace) {
                
                for (const doFormat of formatters) {
                    const results = doFormat(this.document.lineAt(i));
                    if (results) {

                        if (!blockStartFound) {
                            blockStartFound = true;
                        }

                        pushTextEdits(results);

                        // Matching formatter can immediately request the following line.
                        function tryFormatNextLine(document: TextDocument, line: number, endLine: number, results: FormatterResults, textEdits: TextEdit[]): number {
                            if (line < endLine) {
                                const nextLine = document.lineAt(line + 1);
                                if (results.formatNextLineRequest && results.formatNextLineRequest.requestLine(nextLine)) {
                                    const nextResults = results.formatNextLineRequest.formatLine(nextLine);
                                    if (nextResults) {
                                        pushTextEdits(nextResults);
                                        return tryFormatNextLine(document, ++line, endLine, nextResults, textEdits);
                                    }
                                }
                            }

                            return line;
                        }

                        i = tryFormatNextLine(this.document, i, range.end.line, results, textEdits);
                        break;
                    }
                }
            }

            // If the range is only a portion of a block, go up one line until the start is found
            if (!blockStartFound && (i -= 2) < -1) {
                break;
            }
        }

        return textEdits;
    }

    /**
     * Removes unnecessary spaces from empty lines or after a comment.
     */
    private formatEmptyOrComment(line: TextLine): FormatterResults | undefined {

        // Comment
        if (/^\s*-/.test(line.text)) {
            return { textEdit: Formatter.trimRight(line) };
        }

        // Empty line
        if (this.formatEmptyLines && /^\s*$/.test(line.text)) {

            /**
             * Removes all empty lines following an empty line.
             */
            function removeUnnecessaryEmptyLines(): FormatLineRequest {
                return {
                    requestLine: line => /^\s*$/.test(line.text),
                    formatLine: line => {
                        return {
                            textEdit: new TextEdit(line.rangeIncludingLineBreak, ''),
                            formatNextLineRequest: removeUnnecessaryEmptyLines()
                        };
                    }
                };
            }

            return {
                textEdit: Formatter.trimRight(line),
                formatNextLineRequest: removeUnnecessaryEmptyLines()
            };
        }
    }

    /**
     * Sets the standard spacing in a keyword usage.
     */
    private formatKeyword(line: TextLine): FormatterResults | undefined {
        for (const formatter of Formatter.keywordsFormat) {
            const result = line.text.match(formatter.match);
            if (result) {
                if (!formatter.wanted.test(line.text)) {
                    let j = 1;
                    return {
                        textEdit: new TextEdit(line.range, formatter.text.replace(/\$/g, () => result[j++]))
                    };
                }

                return Formatter.unaltered;
            }
        }
    }

    /**
     * Format a message declaration and its text block. Intended text indentation is not altered.
     */
    private formatMessage(line: TextLine): FormatterResults | undefined {
        const instance = this;
        let lastCenteredTokenLine: number = -1;

        // Format message block following a declaration
        function makeMessageResults(textEdit: TextEdit | undefined) {
            const messageBlock = new parser.messages.MessageBlock(instance.document, line.lineNumber);
            const formatterResults: FormatterResults = {
                textEdit: textEdit,
                formatNextLineRequest: {
                    requestLine: line => messageBlock.isInside(line.lineNumber),
                    formatLine: line => {

                        // Handle center justification token
                        const centeredFormatEdits = instance.formatMessageLineWithCenterToken(line);
                        if (centeredFormatEdits !== null) {
                            lastCenteredTokenLine = line.lineNumber;
                            return {
                                textEdits: centeredFormatEdits,
                                formatNextLineRequest: formatterResults.formatNextLineRequest
                            };
                        }

                        // Handle split justification token
                        const splitTokenEdit = instance.formatMessageLineWithSplitToken(line, lastCenteredTokenLine === line.lineNumber - 1);
                        if (splitTokenEdit !== null) {
                            return {
                                textEdit: splitTokenEdit,
                                formatNextLineRequest: formatterResults.formatNextLineRequest
                            };
                        }

                        // A message block is terminated when another message starts or with two empty lines.
                        // A single empty line is allowed but is better to use a space char to indicate that
                        // is only a break in the message text and not a block end.
                        return {
                            textEdit: /^\s*$/.test(line.text) && line.text !== ' ' ? new TextEdit(line.range, ' ') : undefined,
                            formatNextLineRequest: formatterResults.formatNextLineRequest
                        };
                    }
                }
            };

            return formatterResults;
        }

        // Static message declaration
        const staticMessage = parser.messages.parseStaticMessage(line.text);
        if (staticMessage) {
            return makeMessageResults(!/^[a-zA-Z]+:  \[[0-9]+\]$/.test(line.text) ?
                new TextEdit(line.range, staticMessage.name + ':  [' + staticMessage.id + ']') : undefined);
        }

        // Additional message declaration
        const additionalMessageID = parser.messages.parseMessage(line.text);
        if (additionalMessageID) {
            return makeMessageResults(!/^Message:  [0-9]+$/.test(line.text) ?
                new TextEdit(line.range, 'Message:  ' + additionalMessageID) : undefined);
        }
    }

    /**
     * Format messages with a `<ce>` tag. Message text is aligned left or centered according to options.
     * @returns An array of text edits if accepted, otherwise null.
     */
    private formatMessageLineWithCenterToken(line: TextLine): TextEdit[] | null {
        const token = '<ce>';
        if (line.text.indexOf(token) === -1) {
            return null;
        }

        /**
         * Sets the space between `<ce>` token and message text.
         */
        function setInnerSpace(): TextEdit | undefined {
            const match = line.text.match(/^(\s*<ce>)(\s*)(.*[^\s])\s*$/);
            if (match) {
                const rawTextIndex = match[1].length + match[2].length;
                const indentRange = new Range(line.lineNumber, match[1].length, line.lineNumber, rawTextIndex);

                if (getOptions()['format']['centeredMessages']) {
                    const offset = 35 - (match[3].length / 2);
                    if (match[2].length !== offset) {
                        return new TextEdit(indentRange, ' '.repeat(offset > 0 ? offset : 1));
                    }
                }
                else if (match[2] !== ' ') {
                    return new TextEdit(indentRange, ' ');
                }
            }
        }

        return Formatter.filterTextEdits(
            Formatter.trimLeft(line),
            Formatter.trimRight(line),
            setInnerSpace()
        );
    }

    /**
     * Format `<--->` token in a message line. The token is aligned left or centered according to options.
     * @returns A text edit (valid or undefined) if accepted, otherwise null.
     */
    private formatMessageLineWithSplitToken(line: TextLine, centered: boolean): TextEdit | undefined | null {
        if (!/^\s*<--->\s*$/.test(line.text)) {
            return null;
        }

        const token = '<--->';
        return centered && getOptions()['format']['centeredMessages'] ?
            (!/^( ){37}<--->$/.test(line.text) ? new TextEdit(line.range, ' '.repeat(37) + token) : undefined) :
            (line.text !== token ? new TextEdit(line.range, token) : undefined);
    }

    /**
     * Trims a symbol definition.
     */
    private formatSymbolDefinition(line: TextLine): FormatterResults | undefined {
        if (/^\s*(Item|Person|Place|Clock|Foe)/.test(line.text)) {
            return {
                textEdits: Formatter.filterTextEdits(
                    Formatter.trimRight(line),
                    Formatter.trimLeft(line),
                    ...Formatter.setInnerSpaces(line)
                )
            };
        }
    }

    /**
     * Format a headless entry point.
     */
    private formatHeadlessEntryPoint(line: TextLine): FormatterResults | undefined {
        if (!parser.isEmptyOrComment(line.text) &&
            !parser.symbols.parseSymbol(line.text) &&
            !parser.tasks.parseTask(line.text, this.tables.globalVarsTable.globalVars)) {
            return this.formatTaskScope(line);
        }
    }

    /**
     * Formats the definition of a task and request the following lines until the end of the task block.
     */
    private formatTask(line: TextLine): FormatterResults | undefined {
        const task = parser.tasks.parseTask(line.text, this.tables.globalVarsTable.globalVars);
        if (task) {
            return {
                textEdits: Formatter.filterTextEdits(
                    Formatter.trimRight(line),
                    Formatter.trimLeft(line),
                    ...Formatter.setInnerSpaces(line)
                ),
                formatNextLineRequest: task.type !== parser.tasks.TaskType.Variable ? this.getTaskBlockFormatRequest() : undefined
            };
        }
    }

    /**
     * Format lines following a task definition.
     */
    private formatTaskScope(line: TextLine): FormatterResults | undefined {

        function setIndent(indent: string): TextEdit | undefined {
            const currentIndentMatch = line.text.match(/^\s*/);
            if (!currentIndentMatch) {
                return new TextEdit(new Range(line.range.start, line.range.start), indent);
            }
            else if (currentIndentMatch[0] !== indent) {
                return new TextEdit(new Range(line.range.start, new Position(line.lineNumber, currentIndentMatch[0].length)), indent);
            }
        }

        return {
            textEdits: Formatter.filterTextEdits(
                setIndent(this.indent),
                Formatter.trimRight(line),
                ...Formatter.setInnerSpaces(line)
            ),
            formatNextLineRequest: this.getTaskBlockFormatRequest()
        };
    }

    /**
     * Requests the next line in a task block
     */
    private getTaskBlockFormatRequest(): FormatLineRequest {
        return {
            requestLine: (line) => {
                return !/^\s*$/g.test(line.text) && !parser.tasks.parseTask(line.text, this.tables.globalVarsTable.globalVars);
            },
            formatLine: (line) => {
                return this.formatEmptyOrComment(line) || this.formatTaskScope(line);
            }
        };
    }

    /**
     * Format quest table schema declaration.
     * @example schema: *id, name, description
     */
    private formatTableSchema(line: TextLine): FormatterResults | undefined {
        if (/^\s*schema:/.test(line.text)) {
            const args = line.text.split(',');
            const formatFirstArgument = () => {
                if (!/^\s*schema:\s[^\s]/.test(args[0])) {
                    const parts = args[0].split(':').map(x => x.trim());
                    args[0] = parts[0] + ': ' + parts[1];
                    return true;
                }
                return false;
            };

            return this.formatTableEntryIfRequired(line, args, formatFirstArgument()) || Formatter.unaltered;
        }
    }

    /**
     * Format a quest table entry.
     * @example 0, example, description for the example
     * @todo Align a block of entries on the longest argument.
     */
    private formatTableEntry(line: TextLine): FormatterResults | undefined {
        if (getOptions()['format']['tableEntries'] === 'line') {
            return this.formatTableEntryIfRequired(line, line.text.split(','));
        }
    }

    /**
     * Formats a table entry: trims the line and enforces a single space after the separator.
     */
    private formatTableEntryIfRequired(line: TextLine, args: string[], forceFormat: boolean = false) {
        if (forceFormat || args.find(({ }, index) => !(index === 0 ? /^[^\s](.*[^\s])?$/ : /^\s[^\s](.*[^\s])?$/).test(args[index]))) {
            return {
                textEdit: new TextEdit(line.range, args.map(x => x.trim()).join(', '))
            };
        }
    }

    private static filterTextEdits(...edits: (TextEdit | undefined)[]) {
        return edits.reduce((edits, value) => {
            if (value) {
                edits.push(value);
            }
            return edits;
        }, new Array<TextEdit>());
    }

    /**
     * Remove all spaces at the start of a line.
     */
    private static trimLeft(line: TextLine): TextEdit | undefined {
        const leftSpaces = line.text.match(/^(\s+)/);
        if (leftSpaces) {
            return new TextEdit(new Range(line.range.start, new Position(line.lineNumber, leftSpaces[1].length)), '');
        }
    }

    /**
     * Remove all spaces at the end of a line.
     */
    private static trimRight(line: TextLine): TextEdit | undefined {
        const rightSpaces = line.text.match(/(\s+)$/);
        if (rightSpaces) {
            return new TextEdit(new Range(new Position(line.lineNumber, line.text.length - rightSpaces[1].length), line.range.end), '');
        }
    }

    /**
     * Enforces words in a string to be separated by a single space.
     */
    private static setInnerSpaces(line: TextLine): TextEdit[] {
        const regex = /[^\s]\s{2,}[^\s]/g;
        const textEdits: TextEdit[] = [];
        let result;
        while ((result = regex.exec(line.text)) !== null) {
            textEdits.push(new TextEdit(new Range(line.lineNumber, result.index + 2, line.lineNumber, result.index + result[0].length - 1), ''));
        }
        return textEdits;
    }
}