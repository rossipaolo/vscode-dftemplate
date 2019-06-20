/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parser';
import { Errors } from './common';

/**
 * Do diagnostics for a quest table.
 * @param document A document with table schema.
 */
export function* tableCheck(document: vscode.TextDocument): Iterable<vscode.Diagnostic> {

    let schema: RegExp | null = null;

    for (let index = 0; index < document.lineCount; index++) {
        const line = document.lineAt(index);

        // Skip comments
        if (parser.isEmptyOrComment(line.text)) {
            continue;
        }

        // Get schema
        if (!schema && /^\s*schema:/.test(line.text)) {
            const args = line.text.split(',').length;
            if (args > 0) {
                schema = new RegExp('^\s*[^,]*(,[^,]*){' + (args - 1) + '}$');
            }

            continue;
        }

        // Check entry against schema
        if (!schema || !schema.test(line.text)) {
            yield Errors.schemaMismatch(line.range);
        }
    }
}