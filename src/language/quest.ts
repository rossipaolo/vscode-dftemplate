/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import { Preamble } from './preamble';
import { Qbn } from './qbn';
import { Qrc } from './qrc';

enum QuestBlock {
    Preamble,
    QRC,
    QBN
}

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
        
        let block = QuestBlock.Preamble;
        this.preamble.found = true;

        for (let index = 0; index < this.document.lineCount; index++) {
            const line = this.document.lineAt(index);
    
            // Skip comments and empty lines
            if (parser.isEmptyOrComment(line.text)) {
                continue;
            }
    
            // Detect next block
            if (line.text.indexOf('QRC:') !== -1) {
                block = QuestBlock.QRC;
                this.qrc.found = true;
                continue;
            }
            else if (line.text.indexOf('QBN:') !== -1) {
                block = QuestBlock.QBN;
                this.qbn.found = true;
                continue;
            }
    
            // Parse current block
            switch (block) {
                case QuestBlock.Preamble:
                    this.preamble.parse(line);
                    break;
                case QuestBlock.QRC:
                    this.qrc.parse(this.document, line);
                    break;
                case QuestBlock.QBN:
                    this.qbn.parse(line);
                    break;
            }
        }
    }

    public getLocation(range: vscode.Range): vscode.Location {
        return new vscode.Location(this.document.uri, range);
    }
}