/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { QuestBlock, QuestBlockKind, Directive, QuestParseContext } from './common';

/**
 * The first block of a quest.
 */
export class Preamble extends QuestBlock {

    public readonly kind = QuestBlockKind.Preamble;

    /**
     * Informations provided by the preamble for quest creation.
     */
    public readonly directives: Directive[] = [];

    /**
     * The mandatory directive with the name of the quest.
     */
    public get questName(): Directive | undefined {
        return this.directives.find(x => x.name === 'Quest');
    }

    /**
    * Parses a line in the Preamble and build its diagnostic context.
    * @param line A line in the preamble.
    */
    public parse(line: vscode.TextLine, context: QuestParseContext): void {
        const directive = Directive.parse(line, context.language);
        if (directive) {
            this.directives.push(directive);
            return;
        }

        this.failedParse.push(line);
    }

    /**
     * Gets the value of the `DisplayName` directive.
     */
    public getDisplayName(): string | undefined {
        const directive = this.directives.find(x => x.name === 'DisplayName');
        if (directive) {
            return directive.parameter.value;
        }
    }
}