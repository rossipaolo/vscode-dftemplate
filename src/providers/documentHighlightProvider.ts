/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { Quest } from '../language/quest';
import { TemplateReferenceProvider } from './referenceProvider';
import { SymbolType } from '../language/static/common';
import { CategorizedQuestResource } from '../language/common';
import { Quests } from '../language/quests';

export class TemplateDocumentHighlightProvider implements vscode.DocumentHighlightProvider {

    public constructor(private readonly quests: Quests) {
    }

    public async provideDocumentHighlights(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.DocumentHighlight[] | undefined> {

        if (Quest.isTable(document.uri)) {
            return;
        }

        const quest = this.quests.get(document);
        const resource = quest.getResource(position);
        if (resource) {
            const locations = TemplateDocumentHighlightProvider.findLocations(quest, resource);
            if (locations) {
                return TemplateDocumentHighlightProvider.makeHighlights(locations, (resource.value as any).range);
            }
        }
    }

    private static findLocations(quest: Quest, resource: CategorizedQuestResource): vscode.Location[] | undefined {
        switch (resource.kind) {
            case 'message':
                return TemplateReferenceProvider.messageReferences(quest, resource.value, false);
            case 'macro':
                return TemplateReferenceProvider.symbolMacroReferences(quest, resource.value);
            case 'type':
                return TemplateReferenceProvider.typeReferences(quest, resource.value as SymbolType);
            case 'symbol':
                return TemplateReferenceProvider.symbolReferences(quest, resource.value, false);
            case 'task':
                return TemplateReferenceProvider.taskReferences(quest, resource.value, false);
            case 'action':
                return TemplateReferenceProvider.actionReferences(quest, resource.value);
        }
    }

    private static makeHighlights(references: vscode.Location[], definition?: vscode.Range) {
        const highlights = references.map(x => new vscode.DocumentHighlight(x.range, vscode.DocumentHighlightKind.Read));
        if (definition) {
            highlights.push(new vscode.DocumentHighlight(definition, vscode.DocumentHighlightKind.Write));
        }
        return highlights;
    }
}