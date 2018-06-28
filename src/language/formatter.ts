/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { Range, TextEdit, TextLine } from 'vscode';
import { Options } from '../extension';

export interface FormatterResults {
    needsEdit: boolean;
    textEdit?: TextEdit;
}

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

    public static formatComment(line: TextLine): FormatterResults | undefined {
        let text = line.text;
        let result = /^(\s*)(-+)(\s*)([^\s])/g.exec(text);
        if (result) {
            // Remove indent
            if (result[1].length > 0) {
                let length = text.length;
                text = text.trim();
                return Formatter.makeResults(line, length, text);
            }

            return Formatter.unaltered;
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
            if (Options.centeredMessages) {

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

    private static makeResults(line: TextLine, length: number, text: string): FormatterResults {
        return { needsEdit: true, textEdit: new TextEdit(new Range(line.range.start.line, 0, line.range.end.line, length), text) };
    }
}