/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { Range, TextEdit, TextLine, TextDocument, FormattingOptions } from 'vscode';
import { getOptions } from '../extension';
import { MessageBlock } from '../parsers/parser';

export interface FormatterResults {
    needsEdit: boolean;
    textEdit?: TextEdit;
    formatNextLineRequest?: FormatLineRequest;
}

export interface FormatLineRequest {
    requestLine: (line: TextLine) => boolean;
    formatLine: (line: TextLine) => FormatterResults | undefined;
}

type FormatterCallback = (line: TextLine) => FormatterResults | undefined;

export class Formatter {

    private static readonly unaltered: FormatterResults = { needsEdit: false };
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
            match: /^\s*(QRC|QBN)\s*:\s*$/,
            wanted: /^(QRC|QBN):$/,
            text: "$:"
        },
    ];

    private readonly document: TextDocument;
    private readonly indent: string;
    private readonly _qrcFormatters: FormatterCallback[] = [
        (line) => this.formatKeyword(line),
        (line) => this.formatMessage(line),
        (line) => this.formatEmptyLine(line),
        (line) => this.formatComment(line)
    ];
    private readonly _qbnFormatters: FormatterCallback[] = [
        (line) => this.formatEmptyLine(line),
        (line) => this.formatComment(line),
        (line) => this.formatSymbolDefinition(line),
        (line) => this.formatHeadlessEntryPoint(line),
        (line) => this.formatTask(line)
    ];
    private readonly _tableFormatters: FormatterCallback[] = [
        (line) => this.formatEmptyLine(line),
        (line) => this.formatComment(line),
        (line) => this.formatTableSchema(line),
        (line) => this.formatTableEntry(line)
    ];

    /**
     * Formatters for preamble and QRC block.
     */
    public get qrcFormatters() {
        return this._qrcFormatters;
    }

    /**
     * Formatters for QBN block.
     */
    public get qbnFormatters() {
        return this._qbnFormatters;
    }

    /**
     * Formatters for Quest Tables
     */
    public get tableFormatters() {
        return this._tableFormatters;
    }

    public constructor(document: TextDocument, options: FormattingOptions) {
        this.document = document;
        this.indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    }

    private formatKeyword(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let length = text.length;
        for (let i = 0; i < Formatter.keywordsFormat.length; i++) {
            let format = Formatter.keywordsFormat[i];
            let result = new RegExp(format.match, 'g').exec(text);
            if (result) {
                if (!new RegExp(format.wanted, 'g').test(text)) {
                    let j = 1;
                    text = format.text.replace(/\$/g, () => result ? result[j++] : '');
                    return this.makeResults(line, length > text.length ? length : text.length, text);
                }

                return Formatter.unaltered;
            }
        }
    }

    /**
     * Remove unnecessary spaces from empty lines.
     */
    private formatEmptyLine(line: TextLine): FormatterResults | undefined {
        if (/^\s*$/.test(line.text)) {
            return line.text.length > 0 ? {
                needsEdit: true,
                textEdit: new TextEdit(line.range, '')
            } : Formatter.unaltered;
        }
    }

    private formatComment(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let result = /^(\s*)(-+)(\s*)(.*)$/g.exec(text);
        if (result) {
            let length = text.length;
            let needsEdit = false;

            // Keep only one space between comment char and text
            if (result[3].length !== 1) {
                text = result[1] + result[2] + ' ' + result[4];
                needsEdit = true;
            }

            // Remove spaces after last char
            if (/\s+$/) {
                text = text.replace(/\s+$/, '');
                needsEdit = true;
            }

            return needsEdit ? this.makeResults(line, length, text) : Formatter.unaltered;
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
            const messageBlock = new MessageBlock(instance.document, line.lineNumber);
            const formatterResults: FormatterResults = {
                needsEdit: textEdit !== undefined,
                textEdit: textEdit,
                formatNextLineRequest: {
                    requestLine: line => messageBlock.isInside(line.lineNumber),
                    formatLine: line => {

                        // Handle center justification token
                        const centeredFormat = instance.formatCenteredMessageLine(line);
                        if (centeredFormat) {
                            centeredFormat.formatNextLineRequest = formatterResults.formatNextLineRequest;
                            lastCenteredTokenLine = line.lineNumber;
                            return centeredFormat;
                        }

                        // Handle split justification token
                        const splitToken = instance.formatMessageLineWithSplitToken(line, lastCenteredTokenLine === line.lineNumber - 1);
                        if (splitToken) {
                            splitToken.formatNextLineRequest = formatterResults.formatNextLineRequest;
                            return splitToken;
                        }

                        // A message block is terminated when another message starts or with two empty lines.
                        // A single empty line is allowed but is better to use a space char to indicate that
                        // is only a break in the message text and not a block end.
                        const needsEdit = /^\s*$/.test(line.text) && line.text !== ' ';
                        return {
                            needsEdit: needsEdit,
                            textEdit: needsEdit ? new TextEdit(line.range, ' ') : undefined,
                            formatNextLineRequest: formatterResults.formatNextLineRequest
                        };
                    }
                }
            };

            return formatterResults;
        }

        // Static message declaration
        const staticMessage = parser.getStaticMessage(line.text);
        if (staticMessage) {
            return makeMessageResults(!/^[a-zA-Z]+:  \[[0-9]+\]$/.test(line.text) ?
                new TextEdit(line.range, staticMessage.name + ':  [' + staticMessage.id + ']') : undefined);
        }

        // Additional message declaration
        const additionalMessageID = parser.getMessageIDFromLine(line);
        if (additionalMessageID) {
            return makeMessageResults(!/^Message:  [0-9]+$/.test(line.text) ?
                new TextEdit(line.range, 'Message:  ' + additionalMessageID) : undefined);
        }
    }

    /**
     * Format messages with a `<ce>` tag. Message text is aligned left or centered according to options.
     */
    private formatCenteredMessageLine(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let result = /^(\s*)(<ce>)(\s*)([^\s])/g.exec(text);
        if (result) {
            let length = text.length;
            let indent = result[1];
            let identifier = result[2];
            let space = result[3];
            let needsEdit = false;

            // Remove indent for identifier
            if (indent.length > 0) {
                text = text.substring(indent.length);
                needsEdit = true;
            }

            // Set inner indent for text
            let rawTextIndex = identifier.length + space.length;
            if (getOptions()['format']['centeredMessages']) {

                const center = 39;  // position of text center from line start

                let rawText = text.substring(rawTextIndex);
                let offset = center - (rawTextIndex + rawText.length / 2);
                if (offset !== 0) {
                    text = identifier + ' '.repeat(space.length + offset) + rawText;
                    needsEdit = true;
                }
            }
            else if (space.length !== 1) {
                let rawText = text.substring(rawTextIndex);
                text = identifier + ' ' + rawText;
                needsEdit = true;
            }

            return needsEdit ? this.makeResults(line, length, text) : this.makeUnaltered();
        }
    }

    /**
     * Format `<--->` token in a message line. The token is aligned left or centered according to options.
     */
    private formatMessageLineWithSplitToken(line: TextLine, centered: boolean): FormatterResults | undefined {

        const token = '<--->';
        if (/^\s*<--->\s*$/.test(line.text)) {

            // centered
            if (centered && getOptions()['format']['centeredMessages']) {
                return !/^( ){37}<--->$/.test(line.text) ? {
                    needsEdit: true,
                    textEdit: new TextEdit(line.range, ' '.repeat(37) + token),
                } : this.makeUnaltered();
            }

            // left alignment
            return line.text !== token ? {
                needsEdit: true,
                textEdit: new TextEdit(line.range, token),
            } : this.makeUnaltered();
        }
    }

    private formatSymbolDefinition(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let result = /^(\s*)(Item|Person|Place|Clock|Foe)/g.exec(text);
        if (result) {
            let indent = result[1];
            let length = text.length;
            let needsEdit = false;

            // Remove indent
            if (indent.length > 0) {
                text = text.trim();
                needsEdit = true;
            }

            // Fix spacing
            if (/\s\s+/g.test(text)) {
                text = text.replace(/\s\s+/g, ' ');
                needsEdit = true;
            }

            return needsEdit ? this.makeResults(line, length, text) : Formatter.unaltered;
        }
    }

    /**
     * Format a headless entry point.
     */
    private formatHeadlessEntryPoint(line: TextLine): FormatterResults | undefined {
        if (!parser.isEmptyOrComment(line.text) &&
            !parser.getSymbolFromLine(line) &&
            !parser.getTaskName(line.text) &&
            !parser.getGlobalVariable(line.text)) {
            return this.formatTaskScope(line);
        }
    }

    /**
     * Format definition of a task and request following lines until the first empty line.
     */
    private formatTask(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let length = text.length;
        let result = /^(\s*)((_{1,3}|={1,2})[a-zA-Z]+(.[0-9]+)?_)(\s+)task:(\s*)$/g.exec(text);
        if (result) {
            let needsEdit = false;
            if (needsEdit = result[5].length > 1) {
                text = result[2] + ' ' + 'task:';
            }
            else if (needsEdit = (result[1].length > 0 || result[6].length > 0)) {
                text = text.trim();
            }

            return this.makeTaskResults(needsEdit, line, text, length);
        }
    }

    /**
     * Format lines following a task definition.
     */
    private formatTaskScope(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let length = text.length;
        let result = /^(\s*)[^\s]/g.exec(text);
        if (result) {
            let needsEdit = false;
            if (result[1] !== this.indent) {
                text = this.indent + text.trim();
                needsEdit = true;
            }

            return this.makeTaskResults(needsEdit, line, text, length);
        }
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

    private makeUnaltered(): FormatterResults {
        return { needsEdit: false };
    }

    private makeResults(line: TextLine, length: number, text: string): FormatterResults {
        return { needsEdit: true, textEdit: new TextEdit(new Range(line.range.start.line, 0, line.range.end.line, length), text) };
    }

    private makeTaskResults(needsEdit: boolean, line: TextLine, text: string, length: number) {
        let results = needsEdit ? this.makeResults(line, length, text) : { needsEdit: false };
        results.formatNextLineRequest = {
            requestLine: (line) => {
                return !/^\s*$/g.test(line.text);
            },
            formatLine: (line) => {
                return this.formatComment(line) || this.formatTaskScope(line);
            }
        };
        return results;
    }

    /**
     * Formats a table entry: trims the line and enforces a single space after the separator.
     */
    private formatTableEntryIfRequired(line: TextLine, args: string[], forceFormat: boolean = false) {
        if (forceFormat || args.find(({}, index) => !(index === 0 ? /^[^\s](.*[^\s])?$/ : /^\s[^\s](.*[^\s])?$/).test(args[index]))) {
            return {
                needsEdit: true,
                textEdit: new TextEdit(line.range, args.map(x => x.trim()).join(', '))
            };
        }
    }
}