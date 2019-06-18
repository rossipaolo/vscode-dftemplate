/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, Range, ProviderResult, FoldingRange, FoldingRangeKind } from 'vscode';
import { Quest } from '../language/quest';

export class TemplateFoldingRangeProvider implements vscode.FoldingRangeProvider {

    provideFoldingRanges(document: TextDocument): ProviderResult<FoldingRange[]> {
        if (Quest.isTable(document.uri)) {
            return undefined;
        }

        const quest = Quest.get(document);
        const foldingRanges: FoldingRange[] = [];

        const makeFoldingRange = (range: Range, kind?: FoldingRangeKind) => new FoldingRange(range.start.line, range.end.line, kind);

        if (quest.qrc.range !== undefined) {
            foldingRanges.push(makeFoldingRange(quest.qrc.range));

            for (const message of quest.qrc.messages) {
                foldingRanges.push(makeFoldingRange(message.blockRange));
            }
        }

        if (quest.qbn.range !== undefined) {
            foldingRanges.push(makeFoldingRange(quest.qbn.range));

            const entryPoint = quest.qbn.entryPoint;
            foldingRanges.push(makeFoldingRange(entryPoint[0].blockRange.union(entryPoint[entryPoint.length - 1].blockRange)));

            for (const task of quest.qbn.iterateTasks()) {
                if (!task.isVariable) {
                    foldingRanges.push(makeFoldingRange(task.blockRange));
                }
            }
        }

        for (const range of quest.comments) {
            if (!range.isSingleLine) {
                foldingRanges.push(makeFoldingRange(range, FoldingRangeKind.Comment));
            }
        }

        return foldingRanges;
    }
}