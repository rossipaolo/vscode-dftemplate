/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as parser from '../parsers/parser';

import { Range, TextEdit, TextLine } from 'vscode';
import { getOptions } from '../extension';

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
        {
            match: /^\s*Message:\s*([0-9]+)\s*$/,
            wanted: /^Message:\s{2}[0-9]+$/,
            text: "Message:  $"
        },
        {
            match: /^\s*([a-zA-Z]+)\s*:\s*\[\s*([0-9]+)\s*\]\s*$/,
            wanted: /^[a-zA-Z]+:\s{2}\[[0-9]+\]$/,
            text: "$:  [$]"
        }
    ];

    /**
     * Formatters for preamble and QRC block.
     */
    public static qrcFormatters: FormatterCallback[] = [
        Formatter.formatKeyword,
        Formatter.formatComment,
        Formatter.formatCenteredMessage,
    ];

    /**
     * Formatters for QBN block.
     */
    public static qbnFormatters: FormatterCallback[] = [
        Formatter.formatEmptyLine,
        Formatter.formatComment,
        Formatter.formatSymbolDefinition,
        Formatter.formatHeadlessEntryPoint,
        Formatter.formatTask
    ];

    /**
     * Formatters for Quest Tables
     */
    public static tableFormatters: FormatterCallback[] = [
        Formatter.formatEmptyLine,
        Formatter.formatComment,
        Formatter.formatTableSchema,
        Formatter.formatTableEntry
    ];

    public static formatKeyword(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let length = text.length;
        for (let i = 0; i < Formatter.keywordsFormat.length; i++) {
            let format = Formatter.keywordsFormat[i];
            let result = new RegExp(format.match, 'g').exec(text);
            if (result) {
                if (!new RegExp(format.wanted, 'g').test(text)) {
                    let j = 1;
                    text = format.text.replace(/\$/g, () => result ? result[j++] : '');
                    return Formatter.makeResults(line, length > text.length ? length : text.length, text);
                }

                return Formatter.unaltered;
            }
        }
    }

    /**
     * Remove unnecessary spaces from empty lines.
     */
    public static formatEmptyLine(line: TextLine): FormatterResults | undefined {
        if (/^\s*$/.test(line.text)) {
            return line.text.length > 0 ? {
                needsEdit: true,
                textEdit: new TextEdit(line.range, '')
            } : Formatter.unaltered;
        }
    }

    public static formatComment(line: TextLine): FormatterResults | undefined {
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

            return needsEdit ? Formatter.makeResults(line, length, text) : Formatter.unaltered;
        }
    }

    /**
     * Format messages with a <ce> tag. Message text is aligned left or centered according to options.
     */
    public static formatCenteredMessage(line: TextLine): FormatterResults | undefined {
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

            return needsEdit ? Formatter.makeResults(line, length, text) : Formatter.unaltered;
        }
    }

    public static formatSymbolDefinition(line: TextLine): FormatterResults | undefined {
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

            return needsEdit ? Formatter.makeResults(line, length, text) : Formatter.unaltered;
        }
    }

    /**
     * Format a headless entry point.
     */
    public static formatHeadlessEntryPoint(line: TextLine): FormatterResults | undefined {

        if (!parser.isEmptyOrComment(line.text) &&
            !parser.getSymbolFromLine(line) &&
            !parser.getTaskName(line.text) &&
            !parser.getGlobalVariable(line.text)) {
            return Formatter.formatTaskScope(line);
        }
    }

    /**
     * Format definition of a task and request following lines until the first empty line.
     */
    public static formatTask(line: TextLine): FormatterResults | undefined {
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

            return Formatter.makeTaskResults(needsEdit, line, text, length);
        }
    }

    /**
     * Format lines following a task definition.
     */
    private static formatTaskScope(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let length = text.length;
        let result = /^(\s*)[^\s]/g.exec(text);
        if (result) {
            let needsEdit = false;
            if (result[1].length !== 4) {
                text = '    ' + text.trim();
                needsEdit = true;
            }

            return Formatter.makeTaskResults(needsEdit, line, text, length);
        }
    }

    /**
     * Format quest table schema declaration.
     * @example schema: *id, name, description
     */
    public static formatTableSchema(line: TextLine): FormatterResults | undefined {
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

            return Formatter.formatTableEntryIfRequired(line, args, formatFirstArgument()) || Formatter.unaltered;
        }
    }

    /**
     * Format a quest table entry.
     * @example 0, example, description for the example
     * @todo Align a block of entries on the longest argument.
     */
    public static formatTableEntry(line: TextLine): FormatterResults | undefined {
        if (getOptions()['format']['tableEntries'] === 'line') {
            return Formatter.formatTableEntryIfRequired(line, line.text.split(','));
        }
    }

    private static makeResults(line: TextLine, length: number, text: string): FormatterResults {
        return { needsEdit: true, textEdit: new TextEdit(new Range(line.range.start.line, 0, line.range.end.line, length), text) };
    }

    private static makeTaskResults(needsEdit: boolean, line: TextLine, text: string, length: number) {
        let results = needsEdit ? Formatter.makeResults(line, length, text) : { needsEdit: false };
        results.formatNextLineRequest = {
            requestLine: (line) => {
                return !/^\s*$/g.test(line.text);
            },
            formatLine: (line) => {
                return Formatter.formatComment(line) || Formatter.formatTaskScope(line);
            }
        };
        return results;
    }

    /**
     * Formats a table entry: trims the line and enforces a single space after the separator.
     */
    private static formatTableEntryIfRequired(line: TextLine, args: string[], forceFormat: boolean = false) {
        if (forceFormat || args.find(({}, index) => !(index === 0 ? /^[^\s](.*[^\s])?$/ : /^\s[^\s](.*[^\s])?$/).test(args[index]))) {
            return {
                needsEdit: true,
                textEdit: new TextEdit(line.range, args.map(x => x.trim()).join(', '))
            };
        }
    }
}