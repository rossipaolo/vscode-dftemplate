/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { Errors, Warnings } from './common';
import { analyseSignature } from './signatureCheck';
import { Quest } from '../language/quest';
import { LanguageData } from '../language/static/languageData';

/**
 * Analyses the Preamble of a quest.
 * @param quest The quest that owns target preamble.
 * @param data Language data used for linting.
 */
export function* analysePreamble(quest: Quest, data: LanguageData): Iterable<vscode.Diagnostic> {
    for (const directive of quest.preamble.directives) {
        yield* analyseSignature(quest, data, directive.line, [directive.parameter], false);

        if (!quest.document.isUntitled && !directive.valueRange.isEmpty &&
            directive.name === 'Quest' && quest.name !== directive.parameter.value) {
            yield Warnings.questNameMismatch(directive.valueRange);
        }
    }

    for (const line of quest.preamble.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'Preamble');
    }
}