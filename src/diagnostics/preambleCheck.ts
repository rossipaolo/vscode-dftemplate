/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { Errors } from './common';
import { analyseSignature } from './signatureCheck';
import { Quest } from '../language/quest';
import { LanguageData } from '../language/static/languageData';

/**
 * Analyses the Preamble of a quest.
 * @param context Diagnostic context for the current document.
 * @param data Language data used for linting.
 */
export function* analysePreamble(context: Quest, data: LanguageData): Iterable<vscode.Diagnostic> {
    for (const action of context.preamble.directives) {
        yield* analyseSignature(context, data, action.line, [action.parameter], false);
    }

    for (const line of context.preamble.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'Preamble');
    }
}