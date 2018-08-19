/**
 *  Daggerfall Template for Visual Studio Code
 */

'use strict';

import * as vscode from 'vscode';
import * as parser from '../parsers/parser';

import { TextDocument, CancellationToken, CodeLens } from 'vscode';

export class TemplateCodeLensProvider implements vscode.CodeLensProvider {

    public constructor() {
        vscode.commands.registerCommand('dftemplate.revealRange', (range: vscode.Range) => {
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.revealRange(range);
            }
        });
    }

    public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
        const codelenses: CodeLens[] = [];

        const clocks: { line: vscode.TextLine, symbol: string }[] = [];

        // Messages
        for (const message of parser.findAllMessages(document)) {
            const referenceCodeLens = TemplateCodeLensProvider.getReferenceCodeLens(document, message,
                () => parser.findMessageReferences(document, message.symbol, false));
            if (referenceCodeLens) {
                codelenses.push(referenceCodeLens);
            }
        }

        // Symbols
        for (const definition of parser.findAllSymbolDefinitions(document)) {
            const referenceCodeLens = TemplateCodeLensProvider.getReferenceCodeLens(document, definition,
                () => parser.findSymbolReferences(document, definition.symbol, false));
            if (referenceCodeLens) {
                codelenses.push(referenceCodeLens);

                // Find clocks
                if (/^\s*Clock/.test(definition.line.text)) {
                    clocks.push(definition);
                }
            }
        }

        // Variables
        for (const definition of parser.findAllVariables(document)) {
            const referenceCodeLens = TemplateCodeLensProvider.getReferenceCodeLens(document, definition,
                () => parser.findTasksReferences(document, definition.symbol, false));
            if (referenceCodeLens) {
                codelenses.push(referenceCodeLens);
            }
        }

        // Tasks
        for (const definition of parser.findAllTasks(document)) {
            const referenceCodeLens = TemplateCodeLensProvider.getReferenceCodeLens(document, definition,
                () => parser.findTasksReferences(document, definition.symbol, false));
            if (referenceCodeLens) {
                codelenses.push(referenceCodeLens);

                // Clocks
                const clock = clocks.find(x => x.symbol === definition.symbol);
                if (clock) {
                    codelenses.push(new CodeLens(referenceCodeLens.range,
                        {
                            title: 'clock timer',
                            command: 'dftemplate.revealRange',
                            arguments: [clock.line.range]
                        })
                    );
                }

                // Tasks started by a condition
                if (parser.isConditionalTask(document, definition.line.lineNumber)) {
                    codelenses.push(new CodeLens(referenceCodeLens.range, { title: 'conditional execution', command: '' })
                    );
                }
            }
        }

        return codelenses;
    }

    private static getReferenceCodeLens(document: TextDocument, task: { line: vscode.TextLine, symbol: string },
        findReferencesWithoutDeclaration: (document: TextDocument, symbol: string) => Iterable<vscode.Range>): CodeLens | undefined {
        const locations: vscode.Location[] = [];
        for (const range of findReferencesWithoutDeclaration(document, task.symbol)) {
            locations.push(new vscode.Location(document.uri, range));
        }

        const index = task.line.text.indexOf(task.symbol);
        if (index !== -1) {
            const range = new vscode.Range(task.line.lineNumber, index, task.line.lineNumber, index + task.symbol.length);
            return locations.length > 0 ?
                new CodeLens(range,
                    {
                        title: locations.length === 1 ? '1 reference' : locations.length + ' references',
                        command: 'editor.action.showReferences',
                        arguments: [document.uri, new vscode.Position(task.line.lineNumber, index), locations]
                    }
                ) :
                new CodeLens(range, { title: '0 references', command: '' });
        }
    }
}