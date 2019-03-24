/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { Errors } from './common';
import { analyseSignature } from './signatureCheck';
import { Quest } from '../language/quest';

/**
 * Analyses the Preamble of a quest.
 * @param context Diagnostic context for the current document.
 */
export function* analysePreamble(context: Quest): Iterable<vscode.Diagnostic> {
    for (const action of context.preamble.directives) {
        yield* analyseSignature(context, action.line, action.signature, true);
    }

    for (const line of context.preamble.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'Preamble');
    }
}