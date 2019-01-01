/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';
import * as common from './common';
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
        this.preamble.start = 0;

        for (let index = 0; index < this.document.lineCount; index++) {
            const line = this.document.lineAt(index);
    
            // Skip comments and empty lines
            if (parser.isEmptyOrComment(line.text)) {
                continue;
            }
    
            // Detect next block
            if (line.text.indexOf('QRC:') !== -1) {
                block = QuestBlock.QRC;
                this.qrc.start = line.lineNumber;
                continue;
            }
            else if (line.text.indexOf('QBN:') !== -1) {
                block = QuestBlock.QBN;
                this.qbn.start = line.lineNumber;
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

        this.preamble.end = this.qrc.start ? this.qrc.start - 1 : undefined;
        this.qrc.end = this.qbn.start ? this.qbn.start - 1 : undefined;
        this.qbn.end = this.document.lineCount - 1;
    }

    /**
     * Gets the location for a quest block.
     * @param block A quest block or directly a range in the quest file.
     */
    public getLocation(block?: vscode.Range | common.QuestBlock): vscode.Location {   
        if (!block) {
            block = new vscode.Range(0, 0, this.document.lineCount, 0);
        } else if (block instanceof common.QuestBlock) {
            block = block.range || new vscode.Range(0, 0, 0, 0);
        }
        return new vscode.Location(this.document.uri, block);
    }
}