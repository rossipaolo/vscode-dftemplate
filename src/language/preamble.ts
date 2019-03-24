/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { Language } from './static/language';
import { QuestBlock, Action } from './common';

/**
 * The first block of a quest.
 */
export class Preamble extends QuestBlock {

    /**
     * Informations provided by the preamble for quest creation.
     */
    public readonly directives: Action[] = [];

    /**
     * The mandatory directive with the name of the quest.
     */
    public get questName(): Action | undefined {
        return this.directives.find(x => x.signature.length > 0 && x.signature[0].value === 'Quest:');
    }

    /**
    * Parses a line in the Preamble and build its diagnostic context.
    * @param line A line in the preamble.
    */
    public parse(line: vscode.TextLine): void {
        const word = parser.getFirstWord(line.text);
        if (word) {
            const result = Language.getInstance().findKeyword(word);
            if (result) {
                this.directives.push(new Action(line, result.signature));
                return;
            }
        }

        this.failedParse.push(line);
    }

    /**
     * Gets the value of the `DisplayName` directive.
     */
    public getDisplayName(): string | undefined {
        for (const directive of this.directives.filter(x => x.signature.length > 1)) {
            if (directive.signature[0].value === 'DisplayName:') {
                return directive.signature.slice(1).map(x => x.value).join(' ');
            }
        }
    }
}