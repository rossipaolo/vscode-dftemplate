/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import { TextDocument, CodeLens } from 'vscode';
import { Modules } from '../language/static/modules';
import { Quests } from '../language/quests';
import { TemplateReferenceProvider } from './referenceProvider';

export class TemplateCodeLensProvider implements vscode.CodeLensProvider {

    public constructor(private readonly modules: Modules, private readonly quests: Quests) {
        vscode.commands.registerCommand('dftemplate.revealRange', (range: vscode.Range) => {
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.revealRange(range);
            }
        });
    }

    public provideCodeLenses(document: TextDocument): CodeLens[] | Thenable<CodeLens[]> {

        const codelenses: CodeLens[] = [];
        const quest = this.quests.get(document);

        // Messages
        for (const message of quest.qrc.messages) {
            const references = TemplateReferenceProvider.messageReferences(quest, message, false);
            codelenses.push(TemplateCodeLensProvider.makeReferencesCodeLens(document, message.range, references));
        }

        // Symbols
        for (const symbol of quest.qbn.iterateSymbols()) {
            const references = TemplateReferenceProvider.symbolReferences(quest, symbol, false);
            codelenses.push(TemplateCodeLensProvider.makeReferencesCodeLens(document, symbol.range, references));
        }

        // Tasks
        for (const task of quest.qbn.iterateTasks()) {

            // References
            const references = TemplateReferenceProvider.taskReferences(quest, task, false);
            codelenses.push(TemplateCodeLensProvider.makeReferencesCodeLens(document, task.range, references));

            // Triggered by a condition
            if (task.hasAnyCondition(this.modules)) {
                codelenses.push(new CodeLens(task.range, { title: 'conditional execution', command: '' }));
            }

            // Triggered by clock
            for (const symbol of quest.qbn.iterateSymbols()) {
                if (symbol.type === 'Clock' && symbol.name === task.node.symbol.value) {
                    codelenses.push(new CodeLens(task.range,
                        {
                            title: 'clock timer',
                            command: 'dftemplate.revealRange',
                            arguments: [symbol.range]
                        })
                    );
                    break;
                }
            }
        }

        return codelenses;
    }

    /**
     * Makes a CodeLens with references count for a resource.
     * @param document The document where the resource is defined.
     * @param range The range of the resource definition.
     * @param references Location of references to the resource.
     */
    private static makeReferencesCodeLens(document: TextDocument, range: vscode.Range, references: vscode.Location[]): CodeLens {
        return new CodeLens(range, references.length > 0 ? {
            title: references.length === 1 ? '1 reference' : references.length + ' references',
            command: 'editor.action.showReferences',
            arguments: [document.uri, range.start, references]
        } : { title: '0 references', command: '' });
    }
}