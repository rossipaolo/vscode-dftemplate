/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { DiagnosticContext, Errors } from './common';
import { Language } from '../language/language';
import { parseActionSignature, analyseSignature } from './signatureCheck';

/**
 * Parses a line in the Preamble and build its diagnostic context.
 * @param line A line in the preamble.
 * @param context Context data for current diagnostics operation. 
 */
export function parsePreamble(line: vscode.TextLine, context: DiagnosticContext): void {
    
    // Keyword use
    const word = parser.getFirstWord(line.text);
    if (word) {
        const result = Language.getInstance().findKeyword(word);
        if (result) {

            context.preamble.actions.push({
                line: line,
                signature: parseActionSignature(result.signature, line.text)
            });

            if (!context.preamble.questName && /^\s*Quest:/.test(line.text)) {
                context.preamble.questName = line.range;
            }

            return;
        }
    }

    context.preamble.failedParse.push(line);
}

/**
 * Analyses the Preamble of a quest.
 * @param document The current open document.
 * @param context Diagnostic context for the current document.
 */
export function* analysePreamble(context: DiagnosticContext): Iterable<vscode.Diagnostic> {
    for (const action of context.preamble.actions) {
        yield* analyseSignature(context, action.line, action.signature, true);
    }

    for (const line of context.preamble.failedParse) {
        yield Errors.undefinedExpression(parser.trimRange(line), 'Preamble');
    }
}