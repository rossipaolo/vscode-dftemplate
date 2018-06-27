/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import { Range, TextEdit, TextLine } from 'vscode';

export interface FormatterResults {
    needsEdit: boolean;
    textEdit?: TextEdit;
}

export class Formatter {

    private static unaltered: FormatterResults = { needsEdit: false };

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

    public static formatCenteredMessage(line: TextLine): FormatterResults | undefined {

        const center = 39; // position of text center from line start

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
            let rawText = text.substring(rawTextIndex);
            let offset = center - (rawTextIndex + rawText.length / 2);
            if (offset !== 0) {
                text = identifier + ' '.repeat(space.length + offset) + rawText;
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