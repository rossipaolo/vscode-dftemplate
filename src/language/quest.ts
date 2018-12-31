/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Preamble } from './preamble';
import { Qbn } from './qbn';
import { Qrc } from './qrc';

/**
 * A quest that corresponds to a text file.
 */
export class Quest {
    
    /**
     * The block that holds quest directives.
     */
    public readonly preamble = new Preamble();

    /**
     * The block that holds text messages usable by the quest.
     */
    public readonly qrc = new Qrc();
    
    /**
     * The block that holds quest resources definition and tasks.
     */
    public readonly qbn = new Qbn();

    public constructor(public readonly document: vscode.TextDocument) {
    }

    public getLocation(range: vscode.Range): vscode.Location {
        return new vscode.Location(this.document.uri, range);
    }
}